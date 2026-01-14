const API_URL = 'https://sales-prediction-mxgp.onrender.com/predict';

document.getElementById('predictionForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const dias = parseInt(document.getElementById('dias').value);

    const resultDiv = document.getElementById('result');
    const errorDiv = document.getElementById('error');
    const predictionsContainer = document.getElementById('predictions-container');
    const predictionsChart = document.getElementById('predictions-chart');
    const modelNameSpan = document.getElementById('modelName');
    const confidenceSpan = document.getElementById('confidence');
    const errorMessageP = document.getElementById('errorMessage');

    // Esconder mensagens anteriores
    resultDiv.classList.add('hidden');
    errorDiv.classList.add('hidden');
    predictionsContainer.innerHTML = '';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ dias: dias })
        });

        if (!response.ok) {
            throw new Error('Erro ao fazer a previsão');
        }

        const data = await response.json();

        // Renderizar cada previsão como um card
        data.predicoes.forEach(predicao => {
            const card = document.createElement('div');
            card.className = 'prediction-card';
            card.innerHTML = `
                <div class="date">
                    <span class="label">📅 Data</span>
                    <span class="value">${predicao.data}</span>
                </div>
                <div class="sales">
                    <span class="label">🔢 Vendas Previstas</span>
                    <span class="value">${predicao.vendas_previstas}</span>
                </div>
                <div class="revenue">
                    <span class="label">💰 Receita Prevista</span>
                    <span class="value">${predicao.receita_prevista}</span>
                </div>
            `;
            predictionsContainer.appendChild(card);
        });

        // Gráfico com Chart.js
        const labels = data.predicoes.map(pred => pred.data);
        const vendas = data.predicoes.map(pred => parseFloat(pred.vendas_previstas));
        const receitas = data.predicoes.map(pred => parseFloat(pred.receita_prevista.replace('R$ ', '').replace(',', '.')));

        const ctx = predictionsChart.getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Vendas Previstas',
                    data: vendas,
                    borderColor: 'rgb(75, 192, 1

