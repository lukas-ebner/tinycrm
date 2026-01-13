import pg from 'pg';

const { Client } = pg;

const SERPER_API_KEY = '4a3b90dd8eb4be0199b16dd123a968785f22cfcd';
const DB_URL = 'postgresql://neondb_owner:npg_M6gIDPs2oUiE@ep-round-feather-agg67a9e-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require';

// Admin user ID für Notes (wird beim ersten Durchlauf geholt)
let adminUserId = null;

// Rate limiting
let requestCount = 0;
const MAX_REQUESTS_PER_MINUTE = 90; // Etwas unter 100 für Sicherheit

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchWebsite(companyName, city) {
  requestCount++;
  if (requestCount > MAX_REQUESTS_PER_MINUTE) {
    console.log('⏸️  Rate limit reached, waiting 60 seconds...');
    await sleep(60000);
    requestCount = 0;
  }

  try {
    const query = `${companyName} ${city} website`;
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        gl: 'de',
        hl: 'de',
        num: 3
      })
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status}`);
    }

    const data = await response.json();

    // Erste URL aus organic results
    if (data.organic && data.organic.length > 0) {
      return data.organic[0].link;
    }

    return null;
  } catch (error) {
    console.error(`Error searching for ${companyName}:`, error.message);
    return null;
  }
}

async function fetchWebsite(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return html;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('  ⏱️  Timeout');
    }
    return null;
  }
}

function analyzeWebsite(html, companyData) {
  if (!html) return null;

  // Extrahiere Text aus HTML (einfach)
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();

  // Keywords für Analyse
  const serviceKeywords = {
    softwaredev: ['software entwicklung', 'softwareentwicklung', 'app entwicklung', 'web entwicklung', 'custom software', 'individual software'],
    consulting: ['beratung', 'consulting', 'prozess', 'digital transformation', 'strategie'],
    agency: ['agentur', 'design', 'marketing', 'branding', 'kreativ'],
    implementation: ['implementierung', 'integration', 'umsetzung', 'projekt'],
    product: ['produkt', 'saas', 'plattform', 'lizenz']
  };

  const teamKeywords = ['team', 'mitarbeiter', 'über uns', 'about'];
  const clientKeywords = ['kunden', 'referenzen', 'projekte', 'portfolio'];

  // Service-Analyse
  const services = [];
  for (const [category, keywords] of Object.entries(serviceKeywords)) {
    if (keywords.some(kw => text.includes(kw))) {
      services.push(category);
    }
  }

  // Team-Größe schätzen
  const hasTeamInfo = teamKeywords.some(kw => text.includes(kw));
  const hasClients = clientKeywords.some(kw => text.includes(kw));

  return {
    services,
    hasTeamInfo,
    hasClients,
    isAgency: services.includes('agency'),
    isProduct: services.includes('product'),
    isSoftwareDev: services.includes('softwaredev'),
    isConsulting: services.includes('consulting')
  };
}

function calculateSuitability(companyData, websiteAnalysis) {
  let score = 3; // Start mit neutral
  const reasons = [];

  // Employee count (falls vorhanden)
  if (companyData.employee_count) {
    if (companyData.employee_count >= 10 && companyData.employee_count <= 30) {
      score += 1;
      reasons.push('✅ Sweet Spot Team-Größe (10-30 MA)');
    } else if (companyData.employee_count >= 5 && companyData.employee_count <= 50) {
      score += 0.5;
      reasons.push('✅ Gute Team-Größe (5-50 MA)');
    } else if (companyData.employee_count < 5) {
      score -= 1;
      reasons.push('❌ Zu klein (< 5 MA)');
    } else if (companyData.employee_count > 50) {
      score -= 0.5;
      reasons.push('⚠️ Eher groß (> 50 MA)');
    }
  }

  // Website-Analyse
  if (websiteAnalysis) {
    if (websiteAnalysis.isSoftwareDev) {
      score += 1;
      reasons.push('✅ Software-Entwicklung');
    }

    if (websiteAnalysis.isConsulting) {
      score += 0.5;
      reasons.push('✅ Beratungs-Services');
    }

    if (websiteAnalysis.isAgency) {
      score += 0.5;
      reasons.push('✅ Agentur (projektbasiert)');
    }

    if (websiteAnalysis.isProduct) {
      score -= 1;
      reasons.push('❌ Produkt-Fokus');
    }

    if (websiteAnalysis.hasClients) {
      score += 0.5;
      reasons.push('✅ Zeigt Referenzen');
    }
  }

  // NACE Code
  if (companyData.nace_code) {
    if (companyData.nace_code.includes('62.10')) {
      score += 0.5;
      reasons.push('✅ Programmierungstätigkeiten');
    } else if (companyData.nace_code.includes('62.20')) {
      score += 0.5;
      reasons.push('✅ IT-Beratung');
    }
  }

  // Legal form
  if (companyData.legal_form === 'GmbH' || companyData.legal_form === 'AG') {
    score += 0.5;
    reasons.push('✅ Stabile Rechtsform');
  }

  // Clamp zwischen 1 und 5
  score = Math.max(1, Math.min(5, Math.round(score)));

  return { score, reasons };
}

function generateStars(score) {
  const filled = '⭐'.repeat(score);
  const empty = '☆'.repeat(5 - score);
  return filled + empty;
}

async function enrichLead(client, lead) {
  console.log(`\n📊 Processing: ${lead.name}`);

  // Check if already enriched
  const existingNotes = await client.query(
    'SELECT content FROM notes WHERE lead_id = $1 AND content LIKE $2',
    [lead.id, '%## Enrichment%']
  );

  if (existingNotes.rows.length > 0) {
    console.log('  ⏭️  Already enriched, skipping');
    return { status: 'skipped', reason: 'already_enriched' };
  }

  let website = lead.website;
  let websiteStatus = 'existing';

  // Find website if missing
  if (!website || website.trim() === '') {
    console.log('  🔍 Searching for website...');
    website = await searchWebsite(lead.name, lead.city);
    websiteStatus = website ? 'found' : 'not_found';

    if (website) {
      console.log(`  ✅ Found: ${website}`);
      // Update website in database
      await client.query('UPDATE leads SET website = $1 WHERE id = $2', [website, lead.id]);
    } else {
      console.log('  ❌ No website found');
    }
  }

  // Analyze website
  let websiteAnalysis = null;
  let websiteContent = '';

  if (website) {
    console.log('  📄 Fetching website...');
    const html = await fetchWebsite(website);

    if (html) {
      console.log('  ✅ Website loaded');
      websiteAnalysis = analyzeWebsite(html, lead);
      websiteContent = html.substring(0, 500); // Für Kontext
    } else {
      console.log('  ❌ Website nicht erreichbar');
      websiteStatus = 'unreachable';
    }
  }

  // Calculate suitability
  const suitability = calculateSuitability(lead, websiteAnalysis);
  console.log(`  🎯 Score: ${suitability.score}/5`);

  // Generate note content
  const today = new Date().toISOString().split('T')[0];
  let noteContent = `## Enrichment ${today}\n\n`;
  noteContent += `**Eignung:** ${generateStars(suitability.score)} (${suitability.score}/5)\n\n`;

  if (websiteAnalysis) {
    const services = websiteAnalysis.services.length > 0
      ? websiteAnalysis.services.join(', ')
      : 'Nicht eindeutig erkennbar';

    noteContent += `**Was sie machen:**\n`;
    noteContent += `Services: ${services}\n`;
    if (lead.nace_code) {
      noteContent += `NACE: ${lead.nace_code}\n`;
    }
    noteContent += `\n`;
  }

  noteContent += `**Bewertung:**\n`;
  suitability.reasons.forEach(reason => {
    noteContent += `${reason}\n`;
  });
  noteContent += `\n`;

  if (lead.employee_count) {
    noteContent += `**Team-Größe:** ${lead.employee_count} Mitarbeiter\n\n`;
  } else {
    noteContent += `**Team-Größe:** Nicht bekannt\n\n`;
  }

  noteContent += `**Potenzielle Pain Points:**\n`;
  if (suitability.score >= 4) {
    noteContent += `- Zeiterfassung & Projektplanung\n`;
    noteContent += `- Ressourcen-Auslastung optimieren\n`;
    noteContent += `- Projektrentabilität tracken\n`;
  } else if (suitability.score >= 3) {
    noteContent += `- Grundlegendes Projekt-Management\n`;
    noteContent += `- Zeiterfassung\n`;
  } else {
    noteContent += `- Ggf. nicht im Fokus für Leadtime\n`;
  }

  if (websiteStatus === 'not_found') {
    noteContent += `\n**Note:** Website konnte nicht gefunden werden\n`;
  } else if (websiteStatus === 'unreachable') {
    noteContent += `\n**Note:** Website nicht erreichbar\n`;
  }

  // Save note
  await client.query(
    'INSERT INTO notes (lead_id, user_id, content) VALUES ($1, $2, $3)',
    [lead.id, adminUserId, noteContent]
  );

  console.log('  ✅ Note saved');

  return {
    status: 'enriched',
    score: suitability.score,
    websiteStatus
  };
}

async function main() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('✅ Connected to database\n');

  // Get admin user ID
  const adminResult = await client.query(
    "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
  );
  adminUserId = adminResult.rows[0].id;
  console.log(`👤 Using user ID: ${adminUserId}\n`);

  // Get test leads
  const args = process.argv.slice(2);
  const testMode = !args.includes('--full');
  const batchSize = testMode ? 5 : 50;

  console.log(`🎯 Mode: ${testMode ? 'TEST (5 leads)' : 'FULL BATCH (50 leads)'}\n`);
  console.log('━'.repeat(60));

  const leadsResult = await client.query(
    `SELECT l.* FROM leads l
     LEFT JOIN notes n ON l.id = n.lead_id AND n.content LIKE '%## Enrichment%'
     WHERE n.id IS NULL
     ORDER BY l.id
     LIMIT $1`,
    [batchSize]
  );

  const leads = leadsResult.rows;
  console.log(`\n📋 Found ${leads.length} leads to enrich\n`);

  if (leads.length === 0) {
    console.log('✅ All leads are already enriched!');
    await client.end();
    return;
  }

  const stats = {
    total: leads.length,
    enriched: 0,
    skipped: 0,
    errors: 0,
    scores: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  };

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    console.log(`\n[${i + 1}/${leads.length}]`);

    try {
      const result = await enrichLead(client, lead);

      if (result.status === 'enriched') {
        stats.enriched++;
        stats.scores[result.score]++;
      } else {
        stats.skipped++;
      }

      // Small delay between requests
      await sleep(1000);

    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      stats.errors++;
    }
  }

  console.log('\n' + '━'.repeat(60));
  console.log('\n📊 SUMMARY\n');
  console.log(`Total processed: ${stats.total}`);
  console.log(`Enriched: ${stats.enriched}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`\nScore distribution:`);
  for (let i = 5; i >= 1; i--) {
    console.log(`  ${i} stars: ${stats.scores[i]}`);
  }
  console.log('');

  await client.end();
}

main().catch(console.error);
