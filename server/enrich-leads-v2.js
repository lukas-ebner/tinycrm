import pg from 'pg';

const { Client } = pg;

const SERPER_API_KEY = '4a3b90dd8eb4be0199b16dd123a968785f22cfcd';
const DB_URL = 'postgresql://neondb_owner:npg_M6gIDPs2oUiE@ep-round-feather-agg67a9e-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require';

// Rate limiting
let requestCount = 0;
const MAX_REQUESTS_PER_MINUTE = 90;

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

    // Erste URL aus organic results (skip North Data)
    if (data.organic && data.organic.length > 0) {
      for (const result of data.organic) {
        if (!result.link.includes('northdata.de')) {
          return result.link;
        }
      }
      return data.organic[0].link; // Fallback
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
    const timeout = setTimeout(() => controller.abort(), 10000);

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
    return null;
  }
}

function extractFromHTML(html) {
  if (!html) return { text: '', cleanText: '' };

  // Remove scripts, styles, etc.
  let cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Extract text
  const text = cleanHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const textLower = text.toLowerCase();

  return { text, cleanText: textLower };
}

function analyzeWebsiteDetailed(html, companyData) {
  if (!html) {
    return {
      services: [],
      products: [],
      clients: [],
      focus: 'Nicht erkennbar',
      technologies: [],
      team_info: null,
      recent_events: [],
      summary: 'Website nicht erreichbar'
    };
  }

  const { text, cleanText } = extractFromHTML(html);

  // SERVICES - detaillierter
  const servicePatterns = {
    'Software-Entwicklung': ['software entwicklung', 'softwareentwicklung', 'app entwicklung', 'entwicklung von software', 'custom development', 'individualentwicklung'],
    'Web-Entwicklung': ['web entwicklung', 'webentwicklung', 'webdesign', 'website entwicklung', 'frontend', 'backend'],
    'App-Entwicklung': ['app entwicklung', 'mobile entwicklung', 'ios entwicklung', 'android entwicklung', 'mobile app'],
    'IT-Beratung': ['beratung', 'consulting', 'it-beratung', 'it consulting', 'strategieberatung'],
    'Cloud Services': ['cloud', 'aws', 'azure', 'google cloud', 'cloud migration', 'cloud lösung'],
    'DevOps': ['devops', 'ci/cd', 'deployment', 'infrastruktur'],
    'UX/UI Design': ['ux', 'ui', 'user experience', 'interface design', 'usability'],
    'E-Commerce': ['e-commerce', 'shop', 'onlineshop', 'webshop', 'shopware', 'magento'],
    'CRM/ERP': ['crm', 'erp', 'salesforce', 'sap', 'business software'],
    'Datenanalyse': ['datenanalyse', 'data analytics', 'business intelligence', 'bi', 'data science'],
    'KI/ML': ['künstliche intelligenz', 'machine learning', 'ki', 'ml', 'ai'],
    'Hosting/Managed Services': ['hosting', 'managed services', 'wartung', 'support', 'betrieb']
  };

  const services = [];
  for (const [service, keywords] of Object.entries(servicePatterns)) {
    if (keywords.some(kw => cleanText.includes(kw))) {
      services.push(service);
    }
  }

  // PRODUCTS
  const productPatterns = {
    'SaaS-Plattform': ['saas', 'plattform', 'online platform', 'software as a service'],
    'Eigenprodukt': ['unser produkt', 'unsere lösung', 'unsere software'],
    'White Label': ['white label', 'partner lösung'],
    'CMS': ['content management', 'cms', 'wordpress', 'drupal', 'typo3']
  };

  const products = [];
  for (const [product, keywords] of Object.entries(productPatterns)) {
    if (keywords.some(kw => cleanText.includes(kw))) {
      products.push(product);
    }
  }

  // CLIENTS/REFERENZEN - versuche Namen zu extrahieren
  const clients = [];

  // Suche nach "Unsere Kunden", "Referenzen", "Portfolio" Sections
  const clientSectionPatterns = [
    /(?:unsere kunden|referenzen|portfolio|projekte|clients|customers)[\s\S]{0,500}/gi,
    /(?:wir arbeiten|arbeiten wir|zusammenarbeit)[\s\S]{0,300}(?:mit|für)[\s\S]{0,200}/gi
  ];

  const foundCompanyNames = new Set();

  // Pattern für Firmennamen (flexibler)
  const companyNamePattern = /\b([A-ZÄÖÜ][A-Za-zäöüß\-]+(?:\s+[A-ZÄÖÜ&][A-Za-zäöüß\-]*){0,4}\s+(?:GmbH|AG|SE|KG|e\.V\.|mbH|Inc\.|Ltd\.|Group|Gruppe)(?:\s+&\s+Co\.\s+KG)?)\b/g;

  // Durchsuche Client-Sections
  for (const sectionPattern of clientSectionPatterns) {
    const sections = text.matchAll(sectionPattern);
    for (const section of sections) {
      const sectionText = section[0];
      const companyMatches = sectionText.matchAll(companyNamePattern);

      for (const match of companyMatches) {
        const companyName = match[1].trim();
        // Filter out obvious false positives
        if (companyName &&
            !companyName.includes('Impressum') &&
            !companyName.includes('Datenschutz') &&
            companyName.length > 5 &&
            companyName.length < 60) {
          foundCompanyNames.add(companyName);
        }
      }
    }
  }

  // Auch im gesamten Text suchen (aber vorsichtiger)
  if (foundCompanyNames.size < 3) {
    const contextPattern = /(?:projekt|für|mit|bei|kunde|client)\s+([A-ZÄÖÜ][A-Za-zäöüß]+(?:\s+[A-ZÄÖÜ][A-Za-zäöüß]+){0,2}\s+(?:GmbH|AG|SE))/gi;
    const contextMatches = text.matchAll(contextPattern);

    for (const match of contextMatches) {
      const companyName = match[1].trim();
      if (companyName &&
          !companyName.includes('Impressum') &&
          companyName.length > 5) {
        foundCompanyNames.add(companyName);
      }
    }
  }

  clients.push(...Array.from(foundCompanyNames).slice(0, 5));

  // TECHNOLOGIES
  const techPatterns = {
    'React': ['react', 'react.js', 'reactjs'],
    'Vue': ['vue', 'vue.js', 'vuejs'],
    'Angular': ['angular'],
    'Node.js': ['node.js', 'nodejs', 'node'],
    'Python': ['python', 'django', 'flask'],
    'PHP': ['php', 'laravel', 'symfony'],
    'Java': ['java', 'spring'],
    '.NET': ['.net', 'c#', 'asp.net'],
    'Docker': ['docker', 'container'],
    'Kubernetes': ['kubernetes', 'k8s'],
    'TypeScript': ['typescript'],
    'MongoDB': ['mongodb', 'mongo'],
    'PostgreSQL': ['postgresql', 'postgres'],
    'MySQL': ['mysql']
  };

  const technologies = [];
  for (const [tech, keywords] of Object.entries(techPatterns)) {
    if (keywords.some(kw => cleanText.includes(kw))) {
      technologies.push(tech);
    }
  }

  // TEAM SIZE
  let team_info = null;
  const teamPatterns = [
    /(\d+)\s*(?:mitarbeiter|employees|team members|kolleg)/i,
    /team\s+von\s+(\d+)/i,
    /(\d+)er\s+team/i
  ];

  for (const pattern of teamPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      team_info = `ca. ${match[1]} Mitarbeiter (Website)`;
      break;
    }
  }

  // Fallback: From company data
  if (!team_info && companyData.employee_count) {
    team_info = `${companyData.employee_count} Mitarbeiter (Handelsregister)`;
  }

  // FOCUS - Was ist der Hauptfokus?
  let focus = '';
  if (services.length > 0) {
    // Die ersten 2-3 Services als Fokus
    focus = services.slice(0, 3).join(', ');
  } else if (products.length > 0) {
    focus = `Produkt-Fokus: ${products.join(', ')}`;
  } else {
    focus = companyData.nace_code || 'IT-Dienstleistungen';
  }

  // RECENT EVENTS - News, Awards, etc.
  const recent_events = [];

  // Suche nach News-Sections oder Awards
  const newsSectionPatterns = [
    /(?:news|aktuelles|neuigkeiten|pressemitteilung)[\s\S]{0,400}/gi,
    /(?:auszeichnung|award|preis|zertifizierung|zertifikat)[\s\S]{0,300}/gi
  ];

  const foundEvents = new Set();

  for (const sectionPattern of newsSectionPatterns) {
    const sections = text.matchAll(sectionPattern);
    for (const section of sections) {
      const sectionText = section[0];

      // Extract sentences with dates or key event words
      const sentences = sectionText.split(/[.!?]\s+/);
      for (const sentence of sentences) {
        const cleanSentence = sentence.replace(/\s+/g, ' ').trim();

        // Check if sentence mentions 2024, 2025, 2026 or key event words
        if (cleanSentence.length > 30 &&
            cleanSentence.length < 200 &&
            (cleanSentence.match(/202[456]/) ||
             cleanSentence.toLowerCase().includes('neu') ||
             cleanSentence.toLowerCase().includes('launch') ||
             cleanSentence.toLowerCase().includes('award') ||
             cleanSentence.toLowerCase().includes('auszeichnung') ||
             cleanSentence.toLowerCase().includes('zertifizierung'))) {
          foundEvents.add(cleanSentence);
        }
      }
    }
  }

  recent_events.push(...Array.from(foundEvents).slice(0, 3));

  // SUMMARY
  let summary = '';
  if (services.length > 0) {
    summary = `${companyData.name} bietet ${services.length} Hauptservices: ${services.slice(0, 3).join(', ')}`;
  }
  if (products.length > 0) {
    summary += summary ? `. Eigene Produkte: ${products.join(', ')}` : `Eigene Produkte: ${products.join(', ')}`;
  }
  if (clients.length > 0) {
    summary += `. Kunden inkl. ${clients.slice(0, 2).join(', ')}`;
  }
  if (technologies.length > 0) {
    summary += `. Tech-Stack: ${technologies.slice(0, 5).join(', ')}`;
  }

  if (!summary) {
    summary = `${companyData.name} - ${companyData.nace_code || 'IT-Dienstleister'}`;
  }

  return {
    services,
    products,
    clients,
    focus,
    technologies,
    team_info,
    recent_events,
    summary
  };
}

function calculateSuitabilityScore(analysis, companyData) {
  let score = 3;
  const reasons = [];

  // Team size
  const teamSize = companyData.employee_count;
  if (teamSize) {
    if (teamSize >= 10 && teamSize <= 30) {
      score += 1.5;
      reasons.push('✅ Sweet Spot Team-Größe (10-30 MA)');
    } else if (teamSize >= 5 && teamSize <= 50) {
      score += 1;
      reasons.push('✅ Gute Team-Größe (5-50 MA)');
    } else if (teamSize < 5) {
      score -= 1;
      reasons.push('❌ Zu klein (< 5 MA)');
    } else if (teamSize > 50) {
      score -= 0.5;
      reasons.push('⚠️ Eher groß (> 50 MA)');
    }
  }

  // Services
  const projectServices = ['Software-Entwicklung', 'Web-Entwicklung', 'App-Entwicklung', 'IT-Beratung'];
  const projectServiceCount = analysis.services.filter(s => projectServices.includes(s)).length;

  if (projectServiceCount >= 2) {
    score += 1;
    reasons.push('✅ Mehrere projektbasierte Services');
  } else if (projectServiceCount === 1) {
    score += 0.5;
    reasons.push('✅ Projektbasierte Services');
  }

  // Products = schlecht
  if (analysis.products.length > 0) {
    score -= 1;
    reasons.push('❌ Produkt-Fokus erkannt');
  }

  // Clients visible
  if (analysis.clients.length >= 3) {
    score += 0.5;
    reasons.push('✅ Mehrere Referenzkunden sichtbar');
  }

  // Tech stack
  if (analysis.technologies.length >= 3) {
    score += 0.5;
    reasons.push('✅ Breiter Tech-Stack');
  }

  // Legal form
  if (companyData.legal_form === 'GmbH' || companyData.legal_form === 'AG') {
    score += 0.5;
    reasons.push('✅ Stabile Rechtsform');
  }

  // Clamp
  score = Math.max(1, Math.min(5, Math.round(score)));

  return { score, reasons };
}

async function enrichLead(client, lead) {
  console.log(`\n📊 Processing: ${lead.name}`);

  // Check if already enriched
  if (lead.enrichment_data) {
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
      await client.query('UPDATE leads SET website = $1 WHERE id = $2', [website, lead.id]);
    } else {
      console.log('  ❌ No website found');
    }
  }

  // Analyze website
  let analysis = null;

  if (website) {
    console.log('  📄 Fetching website...');
    const html = await fetchWebsite(website);

    if (html) {
      console.log('  ✅ Website loaded, analyzing...');
      analysis = analyzeWebsiteDetailed(html, lead);
      console.log(`  📝 Found: ${analysis.services.length} services, ${analysis.clients.length} clients, ${analysis.technologies.length} technologies`);
    } else {
      console.log('  ❌ Website nicht erreichbar');
      websiteStatus = 'unreachable';
      analysis = analyzeWebsiteDetailed(null, lead);
    }
  } else {
    analysis = analyzeWebsiteDetailed(null, lead);
  }

  // Calculate suitability
  const suitability = calculateSuitabilityScore(analysis, lead);
  console.log(`  🎯 Score: ${suitability.score}/5`);

  // Build enrichment data
  const enrichmentData = {
    enriched_at: new Date().toISOString(),
    website_status: websiteStatus,
    services: analysis.services,
    products: analysis.products,
    clients: analysis.clients,
    focus: analysis.focus,
    technologies: analysis.technologies,
    team_info: analysis.team_info,
    recent_events: analysis.recent_events,
    summary: analysis.summary,
    suitability_score: suitability.score,
    suitability_reasons: suitability.reasons
  };

  // Save to database
  await client.query(
    'UPDATE leads SET enrichment_data = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify(enrichmentData), lead.id]
  );

  console.log('  ✅ Enrichment saved');

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

  // Get test leads
  const args = process.argv.slice(2);
  const testMode = !args.includes('--full');
  const batchSize = testMode ? 5 : 50;

  console.log(`🎯 Mode: ${testMode ? 'TEST (5 leads)' : 'FULL BATCH (50 leads)'}\n`);
  console.log('━'.repeat(60));

  const leadsResult = await client.query(
    `SELECT * FROM leads
     WHERE enrichment_data IS NULL
     ORDER BY id
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
