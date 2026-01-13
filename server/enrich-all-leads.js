import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

async function enrichAllLeads() {
  console.log('🚀 Starting continuous enrichment of all leads...\n');

  let totalEnriched = 0;
  let batchNumber = 1;

  while (true) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📦 BATCH ${batchNumber} - Starting...`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    try {
      const { stdout, stderr } = await execPromise('npx tsx enrich-leads-v2.js --full', {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      console.log(stdout);

      if (stderr) {
        console.error('Warnings:', stderr);
      }

      // Extract enriched count from output
      const enrichedMatch = stdout.match(/Enriched: (\d+)/);
      if (enrichedMatch) {
        const batchEnriched = parseInt(enrichedMatch[1]);
        totalEnriched += batchEnriched;

        console.log(`\n✅ Batch ${batchNumber} completed: ${batchEnriched} leads enriched`);
        console.log(`📊 Total enriched so far: ${totalEnriched} leads\n`);

        // If no leads were enriched, we're done
        if (batchEnriched === 0) {
          console.log('\n🎉 ALL LEADS ENRICHED! No more leads to process.\n');
          break;
        }
      }

      batchNumber++;

      // Small pause between batches
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`❌ Error in batch ${batchNumber}:`, error.message);
      console.log('Continuing with next batch...\n');
      batchNumber++;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🏁 FINAL SUMMARY`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Total batches: ${batchNumber - 1}`);
  console.log(`Total leads enriched: ${totalEnriched}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

enrichAllLeads().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
