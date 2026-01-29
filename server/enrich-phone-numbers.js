import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env'), override: true });

const { Pool } = pg;

const SERPER_API_KEY = '657a0d8bc53ecc1603f598c8002b76fbc577167d';

// Rate limiting
let requestCount = 0;
const MAX_REQUESTS_PER_MINUTE = 90;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Validate German phone number format
function validatePhoneNumber(phone) {
  if (!phone || phone.trim() === '') {
    return { valid: false, reason: 'empty' };
  }

  // Remove common separators
  const cleaned = phone.replace(/[\s\-\(\)\/]/g, '');

  // Check for basic patterns
  const patterns = [
    /^\+49[1-9]\d{1,14}$/,           // +49 format
    /^0049[1-9]\d{1,14}$/,           // 0049 format
    /^0[1-9]\d{1,14}$/,              // 0 prefix (German domestic)
  ];

  const isValid = patterns.some(pattern => pattern.test(cleaned));

  if (!isValid) {
    return { valid: false, reason: 'invalid_format', cleaned };
  }

  // Check minimum length (at least area code + number)
  // German numbers: +49 (2-3 chars) + area code (2-5 chars) + number (3-9 chars)
  // Minimum realistic: +49 + 2 + 3 = 8 digits total after +49
  if (cleaned.startsWith('+49')) {
    if (cleaned.length < 11) { // +49 + at least 8 digits
      return { valid: false, reason: 'too_short', cleaned };
    }
  } else if (cleaned.startsWith('0049')) {
    if (cleaned.length < 12) { // 0049 + at least 8 digits
      return { valid: false, reason: 'too_short', cleaned };
    }
  } else if (cleaned.startsWith('0')) {
    if (cleaned.length < 9) { // 0 + at least 8 digits
      return { valid: false, reason: 'too_short', cleaned };
    }
  }

  return { valid: true, cleaned };
}

// Normalize phone number to international format
function normalizePhoneNumber(phone) {
  const cleaned = phone.replace(/[\s\-\(\)\/]/g, '');

  // Already in international format
  if (cleaned.startsWith('+49')) {
    return cleaned;
  }

  // Convert 0049 to +49
  if (cleaned.startsWith('0049')) {
    return '+49' + cleaned.substring(4);
  }

  // Convert German domestic (0...) to +49
  if (cleaned.startsWith('0')) {
    return '+49' + cleaned.substring(1);
  }

  return cleaned;
}

// Search for company phone number using SERPER
async function searchPhoneNumber(companyName, city, website) {
  requestCount++;
  if (requestCount > MAX_REQUESTS_PER_MINUTE) {
    console.log('  ⏸️  Rate limit reached, waiting 60 seconds...');
    await sleep(60000);
    requestCount = 0;
  }

  try {
    // Try multiple search queries
    const queries = [
      `${companyName} ${city} telefon kontakt`,
      `${companyName} ${city} phone number`,
    ];

    if (website) {
      queries.unshift(`site:${website} kontakt telefon`);
    }

    for (const query of queries) {
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
          num: 5
        })
      });

      if (!response.ok) {
        throw new Error(`Serper API error: ${response.status}`);
      }

      const data = await response.json();

      // Extract phone numbers from search results
      const phoneNumbers = extractPhoneNumbers(data);

      if (phoneNumbers.length > 0) {
        console.log(`  📞 Found ${phoneNumbers.length} potential numbers`);
        return phoneNumbers;
      }

      // Small delay between queries
      await sleep(500);
    }

    return [];
  } catch (error) {
    console.error(`  ❌ Search error: ${error.message}`);
    return [];
  }
}

// Extract phone numbers from search results
function extractPhoneNumbers(searchData) {
  const numbers = new Set();

  // German phone number patterns
  const phonePatterns = [
    /\+49[\s\-]?\d{1,5}[\s\-]?\d{1,10}/g,
    /0049[\s\-]?\d{1,5}[\s\-]?\d{1,10}/g,
    /0\d{2,5}[\s\-\/]?\d{1,10}/g,
  ];

  // Search in different parts of the response
  const searchableTexts = [];

  // Organic results
  if (searchData.organic) {
    searchData.organic.forEach(result => {
      if (result.snippet) searchableTexts.push(result.snippet);
      if (result.title) searchableTexts.push(result.title);
    });
  }

  // Knowledge graph
  if (searchData.knowledgeGraph) {
    const kg = searchData.knowledgeGraph;
    if (kg.description) searchableTexts.push(kg.description);
    if (kg.attributes) {
      Object.values(kg.attributes).forEach(attr => {
        if (typeof attr === 'string') searchableTexts.push(attr);
      });
    }
  }

  // Answer box
  if (searchData.answerBox) {
    if (searchData.answerBox.answer) searchableTexts.push(searchData.answerBox.answer);
    if (searchData.answerBox.snippet) searchableTexts.push(searchData.answerBox.snippet);
  }

  // Extract numbers
  searchableTexts.forEach(text => {
    phonePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const normalized = normalizePhoneNumber(match);
          const validation = validatePhoneNumber(normalized);
          if (validation.valid) {
            numbers.add(normalized);
          }
        });
      }
    });
  });

  return Array.from(numbers);
}

// Process a single lead
async function processLead(pool, lead, dryRun = false) {
  console.log(`\n[ID: ${lead.id}] ${lead.name}`);
  console.log(`  Current phone: ${lead.phone || '(none)'}`);

  const validation = validatePhoneNumber(lead.phone);

  if (validation.valid) {
    const normalized = normalizePhoneNumber(lead.phone);
    if (normalized !== lead.phone) {
      console.log(`  ✓ Valid, normalized: ${normalized}`);

      if (!dryRun) {
        await pool.query(
          'UPDATE leads SET phone = $1, phone_verified = true, phone_verified_at = NOW(), updated_at = NOW() WHERE id = $2',
          [normalized, lead.id]
        );
        console.log('  💾 Updated to normalized format ✓');
      }

      return { status: 'normalized', phone: normalized };
    } else {
      console.log('  ✓ Valid format');

      if (!dryRun) {
        await pool.query(
          'UPDATE leads SET phone_verified = true, phone_verified_at = NOW() WHERE id = $1',
          [lead.id]
        );
        console.log('  💾 Marked as verified ✓');
      }

      return { status: 'valid' };
    }
  }

  console.log(`  ❌ Invalid: ${validation.reason}`);
  console.log('  🔍 Searching for phone number...');

  // Search for phone number
  const foundNumbers = await searchPhoneNumber(lead.name, lead.city, lead.website);

  if (foundNumbers.length === 0) {
    console.log('  ❌ No phone number found');
    return { status: 'not_found', reason: validation.reason };
  }

  // Take the first valid number
  const newPhone = foundNumbers[0];
  console.log(`  ✅ Found: ${newPhone}`);

  if (foundNumbers.length > 1) {
    console.log(`  📋 Other options: ${foundNumbers.slice(1).join(', ')}`);
  }

  if (!dryRun) {
    await pool.query(
      'UPDATE leads SET phone = $1, phone_verified = true, phone_verified_at = NOW(), updated_at = NOW() WHERE id = $2',
      [newPhone, lead.id]
    );
    console.log('  💾 Updated in database ✓');
  }

  return { status: 'updated', oldPhone: lead.phone, newPhone };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fullMode = args.includes('--full');
  const limit = fullMode ? 1000 : 20;

  console.log('📞 Phone Number Enrichment Script');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no updates)' : 'LIVE'}`);
  console.log(`Batch size: ${limit} leads`);
  console.log('='.repeat(60));

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Get leads with missing or potentially invalid phone numbers (not yet verified)
    const result = await pool.query(`
      SELECT id, name, phone, city, website
      FROM leads
      WHERE (phone_verified IS NULL OR phone_verified = false)
        AND (
          phone IS NULL
          OR phone = ''
          OR LENGTH(REGEXP_REPLACE(phone, '[^0-9+]', '', 'g')) < 6
          OR phone NOT SIMILAR TO '(%\\+49%|%0049%|0[1-9]%)'
        )
      ORDER BY id
      LIMIT $1
    `, [limit]);

    const leads = result.rows;
    console.log(`\n📋 Found ${leads.length} leads to process\n`);

    if (leads.length === 0) {
      console.log('✅ All phone numbers are valid!');
      await pool.end();
      return;
    }

    const stats = {
      total: leads.length,
      valid: 0,
      normalized: 0,
      updated: 0,
      not_found: 0,
      errors: 0
    };

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      console.log(`\n━━━ [${i + 1}/${leads.length}] ━━━`);

      try {
        const result = await processLead(pool, lead, dryRun);

        switch (result.status) {
          case 'valid':
            stats.valid++;
            break;
          case 'normalized':
            stats.normalized++;
            break;
          case 'updated':
            stats.updated++;
            break;
          case 'not_found':
            stats.not_found++;
            break;
        }

        // Delay between requests
        await sleep(2000);

      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        stats.errors++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total processed: ${stats.total}`);
    console.log(`Already valid: ${stats.valid}`);
    console.log(`Normalized: ${stats.normalized}`);
    console.log(`Updated with new number: ${stats.updated}`);
    console.log(`Not found: ${stats.not_found}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('');

    const successRate = ((stats.valid + stats.normalized + stats.updated) / stats.total * 100).toFixed(1);
    console.log(`✅ Success rate: ${successRate}%`);

    if (dryRun) {
      console.log('\n⚠️  DRY RUN - No changes were made to the database');
      console.log('Run without --dry-run to apply changes');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
