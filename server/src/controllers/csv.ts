import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import pool from '../db/config.js';
import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';

export const importCSV = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get original filename for import_source tracking
    const importSource = req.file.originalname || 'unknown.csv';

    // Decode Windows-1252 to UTF-8
    const fileContent = iconv.decode(req.file.buffer, 'windows-1252');

    // Parse CSV with semicolon delimiter
    const records = parse(fileContent, {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true,
      trim: true
    });

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    const client = await pool.connect();
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    try {
      await client.query('BEGIN');

      // Get default "Neu" stage
      const stageResult = await client.query(
        "SELECT id FROM stages WHERE name = 'Neu' LIMIT 1"
      );

      const defaultStageId = stageResult.rows.length > 0 ? stageResult.rows[0].id : null;

      for (const record of records) {
        try {
          // Map North Data CSV fields
          const registerId = record['Register-ID']?.trim();
          const name = record['Name']?.trim();
          const legalForm = record['Rechtsform']?.trim();
          const zip = record['PLZ']?.trim();
          const city = record['Ort']?.trim();
          const street = record['Straße']?.trim() || record['Strasse']?.trim();
          const phone = record['Tel.']?.trim();
          const email = record['E-Mail']?.trim();
          const website = record['Website']?.trim();
          const naceCode = record['Branche (NACE)']?.trim();
          const businessPurpose = record['Gegenstand']?.trim();
          const ceo1 = record['Ges. Vertreter 1']?.trim();
          const ceo2 = record['Ges. Vertreter 2']?.trim();
          const revenueEur = parseFloat(record['Umsatz EUR']?.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '') || '0') || null;
          const employeeCount = parseInt(record['Mitarbeiterzahl']?.replace(/[^\d]/g, '') || '0') || null;
          const northdataUrl = record['North Data URL']?.trim();

          if (!name) {
            skipped++;
            continue;
          }

          // Check if lead exists by register_id
          const existing = await client.query(
            'SELECT id FROM leads WHERE register_id = $1',
            [registerId]
          );

          if (existing.rows.length > 0) {
            // Update existing lead (keep original import_source, don't overwrite)
            await client.query(
              `UPDATE leads SET
                name = $1, legal_form = $2, zip = $3, city = $4, street = $5,
                phone = $6, email = $7, website = $8, nace_code = $9,
                business_purpose = $10, ceo_1 = $11, ceo_2 = $12,
                revenue_eur = $13, employee_count = $14, northdata_url = $15,
                updated_at = NOW()
              WHERE register_id = $16`,
              [
                name, legalForm, zip, city, street, phone, email, website,
                naceCode, businessPurpose, ceo1, ceo2, revenueEur,
                employeeCount, northdataUrl, registerId
              ]
            );
            updated++;
          } else {
            // Insert new lead with import_source
            await client.query(
              `INSERT INTO leads (
                register_id, name, legal_form, zip, city, street, phone, email,
                website, nace_code, business_purpose, ceo_1, ceo_2,
                revenue_eur, employee_count, northdata_url, stage_id, import_source
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
              [
                registerId, name, legalForm, zip, city, street, phone, email,
                website, naceCode, businessPurpose, ceo1, ceo2,
                revenueEur, employeeCount, northdataUrl, defaultStageId, importSource
              ]
            );
            imported++;
          }
        } catch (recordError) {
          console.error('Error processing record:', recordError);
          skipped++;
        }
      }

      await client.query('COMMIT');

      res.json({
        message: 'CSV import completed',
        stats: {
          total: records.length,
          imported,
          updated,
          skipped
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ error: 'Failed to import CSV' });
  }
};

// Get list of all import sources for filtering
export const getImportSources = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT import_source 
      FROM leads 
      WHERE import_source IS NOT NULL 
      ORDER BY import_source ASC
    `);
    
    res.json({ 
      sources: result.rows.map(r => r.import_source) 
    });
  } catch (error) {
    console.error('Get import sources error:', error);
    res.status(500).json({ error: 'Failed to fetch import sources' });
  }
};

// Get import history with stats
export const getImportHistory = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        import_source,
        COUNT(*) as total_leads,
        COUNT(*) FILTER (WHERE enrichment_data IS NOT NULL) as enriched_leads,
        COUNT(*) FILTER (WHERE enrichment_data IS NULL) as pending_enrichment,
        MIN(created_at) as first_import,
        MAX(created_at) as last_import
      FROM leads 
      WHERE import_source IS NOT NULL 
      GROUP BY import_source
      ORDER BY MAX(created_at) DESC
    `);
    
    res.json({ 
      imports: result.rows.map(r => ({
        name: r.import_source,
        total: parseInt(r.total_leads),
        enriched: parseInt(r.enriched_leads),
        pending: parseInt(r.pending_enrichment),
        firstImport: r.first_import,
        lastImport: r.last_import
      }))
    });
  } catch (error) {
    console.error('Get import history error:', error);
    res.status(500).json({ error: 'Failed to fetch import history' });
  }
};

export const getImportTemplate = (req: AuthRequest, res: Response) => {
  const template = `Name;Rechtsform;PLZ;Ort;Straße;Tel.;E-Mail;Website;Branche (NACE);Gegenstand;Ges. Vertreter 1;Ges. Vertreter 2;Umsatz EUR;Mitarbeiterzahl;North Data URL;Register-ID
Beispiel GmbH;GmbH;93047;Regensburg;Musterstraße 1;+49 941 123456;info@beispiel.de;https://beispiel.de;62.01;Softwareentwicklung;Max Mustermann;;500000;10;https://www.northdata.de/...;HRB 12345`;

  res.setHeader('Content-Type', 'text/csv; charset=windows-1252');
  res.setHeader('Content-Disposition', 'attachment; filename=north_data_template.csv');

  // Encode to Windows-1252
  const encoded = iconv.encode(template, 'windows-1252');
  res.send(encoded);
};
