import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import pool from '../db/config.js';

const SERPER_API_KEY = process.env.SERPER_API_KEY || '4a3b90dd8eb4be0199b16dd123a968785f22cfcd';

// Rate limiting
let requestCount = 0;
const MAX_REQUESTS_PER_MINUTE = 90;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchWebsite(companyName: string, city: string) {
  requestCount++;
  if (requestCount > MAX_REQUESTS_PER_MINUTE) {
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
      body: JSON.stringify({ q: query, gl: 'de', hl: 'de', num: 3 })
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (data.organic && data.organic.length > 0) {
      for (const result of data.organic) {
        if (!result.link.includes('northdata.de')) {
          return result.link;
        }
      }
      return data.organic[0].link;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchWebsite(url: string) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });

    clearTimeout(timeout);
    if (!response.ok) return null;

    return await response.text();
  } catch {
    return null;
  }
}

function extractFromHTML(html: string | null) {
  if (!html) return { text: '', cleanText: '' };

  let cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const text = cleanHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { text, cleanText: text.toLowerCase() };
}

function analyzeWebsite(html: string | null, companyData: any) {
  const { text, cleanText } = extractFromHTML(html);

  // Services
  const servicePatterns: Record<string, string[]> = {
    'Software-Entwicklung': ['software entwicklung', 'softwareentwicklung', 'app entwicklung'],
    'Web-Entwicklung': ['web entwicklung', 'webentwicklung', 'webdesign'],
    'App-Entwicklung': ['app entwicklung', 'mobile entwicklung', 'ios entwicklung', 'android entwicklung'],
    'IT-Beratung': ['beratung', 'consulting', 'it-beratung'],
    'Cloud Services': ['cloud', 'aws', 'azure'],
    'E-Commerce': ['e-commerce', 'shop', 'onlineshop'],
    'KI/ML': ['künstliche intelligenz', 'machine learning', 'ki', 'ml', 'ai'],
  };

  const services: string[] = [];
  for (const [service, keywords] of Object.entries(servicePatterns)) {
    if (keywords.some(kw => cleanText.includes(kw))) {
      services.push(service);
    }
  }

  // Technologies
  const techPatterns: Record<string, string[]> = {
    'React': ['react'], 'Vue': ['vue'], 'Angular': ['angular'],
    'Node.js': ['node.js', 'nodejs'], 'Python': ['python'],
    'Java': ['java'], '.NET': ['.net', 'c#'],
  };

  const technologies: string[] = [];
  for (const [tech, keywords] of Object.entries(techPatterns)) {
    if (keywords.some(kw => cleanText.includes(kw))) {
      technologies.push(tech);
    }
  }

  // Focus
  const focus = services.slice(0, 3).join(', ') || companyData.nace_code || 'IT-Dienstleistungen';

  // Summary
  let summary = '';
  if (services.length > 0) {
    summary = `${companyData.name} bietet ${services.length} Hauptservices: ${services.slice(0, 3).join(', ')}`;
  }
  if (technologies.length > 0) {
    summary += summary ? `. Tech-Stack: ${technologies.slice(0, 5).join(', ')}` : `Tech-Stack: ${technologies.join(', ')}`;
  }
  if (!summary) {
    summary = `${companyData.name} - ${companyData.nace_code || 'IT-Dienstleister'}`;
  }

  return { services, technologies, focus, summary, products: [], clients: [], recent_events: [] };
}

function calculateScore(analysis: any, companyData: any) {
  let score = 3;
  const reasons: string[] = [];

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
    }
  }

  const projectServices = ['Software-Entwicklung', 'Web-Entwicklung', 'App-Entwicklung', 'IT-Beratung'];
  const projectServiceCount = analysis.services.filter((s: string) => projectServices.includes(s)).length;

  if (projectServiceCount >= 2) {
    score += 1;
    reasons.push('✅ Mehrere projektbasierte Services');
  } else if (projectServiceCount === 1) {
    score += 0.5;
    reasons.push('✅ Projektbasierte Services');
  }

  if (companyData.legal_form === 'GmbH' || companyData.legal_form === 'AG') {
    score += 0.5;
    reasons.push('✅ Stabile Rechtsform');
  }

  return { score: Math.min(5, Math.max(1, Math.round(score))), reasons };
}

async function enrichSingleLead(leadId: number) {
  const leadResult = await pool.query('SELECT * FROM leads WHERE id = $1', [leadId]);
  if (leadResult.rows.length === 0) return null;

  const lead = leadResult.rows[0];

  let website = lead.website;
  let websiteStatus = 'none';

  if (!website && lead.city) {
    website = await searchWebsite(lead.name, lead.city);
    if (website) {
      await pool.query('UPDATE leads SET website = $1 WHERE id = $2', [website, lead.id]);
    }
  }

  let analysis;
  if (website) {
    const html = await fetchWebsite(website);
    if (html) {
      websiteStatus = 'online';
      analysis = analyzeWebsite(html, lead);
    } else {
      websiteStatus = 'unreachable';
      analysis = analyzeWebsite(null, lead);
    }
  } else {
    analysis = analyzeWebsite(null, lead);
  }

  const suitability = calculateScore(analysis, lead);

  const enrichmentData = {
    enriched_at: new Date().toISOString(),
    website_status: websiteStatus,
    services: analysis.services,
    products: analysis.products,
    clients: analysis.clients,
    focus: analysis.focus,
    technologies: analysis.technologies,
    team_info: lead.employee_count ? `${lead.employee_count} Mitarbeiter` : null,
    founding_year: null,
    company_age: null,
    recent_events: analysis.recent_events,
    summary: analysis.summary,
    suitability_score: suitability.score,
    suitability_reasons: suitability.reasons
  };

  await pool.query(
    'UPDATE leads SET enrichment_data = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify(enrichmentData), lead.id]
  );

  return { lead_id: lead.id, score: suitability.score, website_status: websiteStatus };
}

// Enrich a single lead
export const enrichLead = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const result = await enrichSingleLead(parseInt(id));

    if (!result) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ message: 'Lead enriched successfully', result });
  } catch (error) {
    console.error('Enrich lead error:', error);
    res.status(500).json({ error: 'Failed to enrich lead' });
  }
};

// Enrich multiple leads by filter (e.g., import_source)
export const enrichByFilter = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { import_source, limit = 50 } = req.body;

    let query = `SELECT id FROM leads WHERE enrichment_data IS NULL`;
    const values: any[] = [];
    let paramCount = 1;

    if (import_source) {
      query += ` AND import_source = $${paramCount++}`;
      values.push(import_source);
    }

    query += ` ORDER BY id LIMIT $${paramCount}`;
    values.push(Math.min(limit, 100)); // Max 100 at a time

    const leadsResult = await pool.query(query, values);
    const leadIds = leadsResult.rows.map(r => r.id);

    if (leadIds.length === 0) {
      return res.json({ message: 'No leads to enrich', enriched: 0 });
    }

    // Start enrichment in background (don't wait for completion)
    const enrichPromise = (async () => {
      let enriched = 0;
      for (const leadId of leadIds) {
        try {
          await enrichSingleLead(leadId);
          enriched++;
          await sleep(1500); // Rate limiting
        } catch (e) {
          console.error(`Failed to enrich lead ${leadId}:`, e);
        }
      }
      console.log(`✅ Enrichment complete: ${enriched}/${leadIds.length} leads`);
    })();

    // Don't await - let it run in background
    enrichPromise.catch(console.error);

    res.json({ 
      message: `Enrichment started for ${leadIds.length} leads`,
      leads_to_enrich: leadIds.length,
      status: 'processing'
    });
  } catch (error) {
    console.error('Enrich by filter error:', error);
    res.status(500).json({ error: 'Failed to start enrichment' });
  }
};

// Get enrichment status (how many leads need enriching)
export const getEnrichmentStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { import_source } = req.query;

    let query = `
      SELECT 
        COUNT(*) FILTER (WHERE enrichment_data IS NULL) as pending,
        COUNT(*) FILTER (WHERE enrichment_data IS NOT NULL) as enriched,
        COUNT(*) as total
      FROM leads
    `;
    const values: any[] = [];

    if (import_source) {
      query = `
        SELECT 
          COUNT(*) FILTER (WHERE enrichment_data IS NULL) as pending,
          COUNT(*) FILTER (WHERE enrichment_data IS NOT NULL) as enriched,
          COUNT(*) as total
        FROM leads
        WHERE import_source = $1
      `;
      values.push(import_source);
    }

    const result = await pool.query(query, values);
    const stats = result.rows[0];

    res.json({
      pending: parseInt(stats.pending),
      enriched: parseInt(stats.enriched),
      total: parseInt(stats.total)
    });
  } catch (error) {
    console.error('Get enrichment status error:', error);
    res.status(500).json({ error: 'Failed to get enrichment status' });
  }
};
