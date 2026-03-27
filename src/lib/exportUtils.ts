import * as XLSX from 'xlsx';

interface Prediction {
  id: string;
  scenario_type: string;
  title: string;
  predicted_kpis: any;
  confidence_scores: any;
  assumptions: string[];
  risk_factors: string[];
  recommendations: string[];
  probability: number;
}

export const exportToExcel = (predictions: Prediction[], name: string) => {
  const workbook = XLSX.utils.book_new();

  predictions.forEach((prediction) => {
    const data = [
      ['Scenario', prediction.title],
      ['Type', prediction.scenario_type],
      ['Probability', `${(prediction.probability * 100).toFixed(0)}%`],
      [],
      ['KPIs Projected'],
      ...Object.entries(prediction.predicted_kpis).map(([key, value]) => [key, value]),
      [],
      ['Assumptions'],
      ...prediction.assumptions.map((a, i) => [`${i + 1}`, a]),
      [],
      ['Risk Factors'],
      ...prediction.risk_factors.map((r, i) => [`${i + 1}`, r]),
      [],
      ['Recommendations'],
      ...prediction.recommendations.map((rec, i) => [`${i + 1}`, rec]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, prediction.scenario_type);
  });

  XLSX.writeFile(workbook, `${name}_predictions.xlsx`);
};

export const exportToPDF = async (predictions: Prediction[], name: string) => {
  // Create a printable HTML version
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${name} - Multi-Scenario Predictions</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 1200px; margin: 0 auto; }
          h1 { color: #1a1a1a; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
          h2 { color: #374151; margin-top: 30px; }
          h3 { color: #6b7280; margin-top: 20px; }
          .scenario { page-break-after: always; margin-bottom: 40px; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; }
          .kpis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 15px 0; }
          .kpi-card { padding: 15px; background: #f9fafb; border-radius: 6px; }
          .kpi-label { font-size: 12px; color: #6b7280; }
          .kpi-value { font-size: 24px; font-weight: bold; color: #1a1a1a; }
          ul { margin: 10px 0; padding-left: 20px; }
          li { margin: 8px 0; line-height: 1.6; }
          .probability { display: inline-block; padding: 4px 12px; background: #dbeafe; color: #1e40af; border-radius: 4px; font-weight: 600; }
          @media print {
            body { padding: 20px; }
            .scenario { page-break-after: always; }
          }
        </style>
      </head>
      <body>
        <h1>${name} - Multi-Scenario Predictions</h1>
        <p style="color: #6b7280; margin-bottom: 30px;">Generated on ${new Date().toLocaleDateString('fr-FR')}</p>
        ${predictions.map(pred => `
          <div class="scenario">
            <h2>${pred.title}</h2>
            <p><span class="probability">Probabilité: ${(pred.probability * 100).toFixed(0)}%</span></p>
            
            <h3>KPIs Projetés</h3>
            <div class="kpis">
              ${Object.entries(pred.predicted_kpis).map(([key, value]) => `
                <div class="kpi-card">
                  <div class="kpi-label">${key}</div>
                  <div class="kpi-value">${value}</div>
                </div>
              `).join('')}
            </div>
            
            ${pred.assumptions?.length ? `
              <h3>Hypothèses</h3>
              <ul>
                ${pred.assumptions.map(a => `<li>${a}</li>`).join('')}
              </ul>
            ` : ''}
            
            ${pred.risk_factors?.length ? `
              <h3>Facteurs de Risque</h3>
              <ul>
                ${pred.risk_factors.map(r => `<li>${r}</li>`).join('')}
              </ul>
            ` : ''}
            
            ${pred.recommendations?.length ? `
              <h3>Recommandations</h3>
              <ul>
                ${pred.recommendations.map(rec => `<li>${rec}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        `).join('')}
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
};
