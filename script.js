const API_URL = 'https://sales-prediction-mxgp.onrender.com';
const SALES_API = '/predict';
const HISTORICAL_API = '/stats';

// Elementos do DOM
const predictionForm = document.getElementById('predictionForm');
const historyFilter = document.getElementById('historico');
const salesChartEl = document.getElementById('sales-trend-chart');
const revenueChartEl = document.getElementById('revenue-chart');
const dailyTable = document.getElementById('daily-data').querySelector('tbody');
const currentDateEl = document.getElementById('current-date');
const summaryCards = document.querySelectorAll('.summary-card');

// Objetos de gráficos
let salesChart = null;
let revenueChart = null;

// Atualizar data atual
function updateCurrentDate() {
    const now = new Date();
    currentDateEl.textContent = now.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

// Formatador de moeda
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

// Carregar dados históricos
async function loadHistoricalData(days = 7) {
    try {
        const response = await fetch(`${API_URL}${HISTORICAL_API}`);
        if (!response.ok) throw new Error('Erro ao carregar histórico');
        return await response.json();
    } catch (error) {
        console.error('Erro histórico:', error);
        return null;
    }
}

// Carregar projeções
async function loadPredictions(days) {
    try {
        const response = await fetch(`${API_URL}${SALES_API}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dias: days })
        });
        if (!response.ok) throw new Error('Erro nas projeções');
        return await response.json();
    } catch (error) {
        console.error('Erro projeções:', error);
        return null;
    }
}

// Renderizar gráfico de vendas
function renderSalesChart(historical, predictions) {
    const ctx = salesChartEl.getContext('2d');

    // Destruir gráfico anterior se existir
    if (salesChart) salesChart.destroy();

    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [...historical.dates, ...predictions.dates],
            datasets: [{
                label: 'Vendas Históricas',
                data: [...historical.sales, ...Array(predictions.dates.length).fill(null)],
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.3,
                fill: true
            }, {
                label: 'Projeção de Vendas',
                data: [...Array(historical.dates.length).fill(null), ...predictions.sales],
                borderColor: '#e74c3c',
                borderDash: [5, 5],
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: false },
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Quantidade de Vendas' } },
                x: { title: { display: true, text: 'Datas' } }
            }
        }
    });
}

// Renderizar gráfico de receita
function renderRevenueChart(historical, predictions) {
    const ctx = revenueChartEl.getContext('2d');

    if (revenueChart) revenueChart.destroy();

    revenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [...historical.dates, ...predictions.dates],
            datasets: [{
                label: 'Receita Histórica (R$)',
                data: [...historical.revenue, ...Array(predictions.dates.length).fill(null)],
                backgroundColor: 'rgba(46, 204, 113, 0.7)',
                borderColor: '#27ae60',
                borderWidth: 1
            }, {
                label: 'Projeção de Receita (R$)',
                data: [...Array(historical.dates.length).fill(null), ...predictions.revenue],
                backgroundColor: 'rgba(241, 196, 15, 0.7)',
                borderColor: '#f39c12',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: {
                y: { 
                    beginAtZero: true,
                    title: { display: true, text: 'Valor em Reais (R$)' }
                }
            }
        }
    });
}

// Atualizar tabela de dados
function updateDataTable(data) {
    dailyTable.innerHTML = '';

    data.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.date}</td>
            <td>${item.sales}</td>
            <td>${formatCurrency(item.revenue)}</td>
            <td>${item.top_product}</td>
            <td>${item.top_seller}</td>
        `;
        dailyTable.appendChild(row);
    });
}

// Atualizar cards de resumo
function updateSummaryCards(historical, predictions) {
    // Card 1: Hoje
    const today = historical[historical.length - 1];
    summaryCards[0].querySelector('.value').textContent = formatCurrency(today.revenue);
    summaryCards[0].querySelector('.sub').textContent = `${today.sales} vendas`;

    // Card 2: Média Diária
    const avgRevenue = historical.reduce((sum, day) => sum + day.revenue, 0) / historical.length;
    const avgSales = historical.reduce((sum, day) => sum + day.sales, 0) / historical.length;
    summaryCards[1].querySelector('.value').textContent = formatCurrency(avgRevenue);
    summaryCards[1].querySelector('.sub').textContent = `${avgSales.toFixed(1)} vendas/dia`;

    // Card 3: Projeção Amanhã
    const tomorrow = predictions[0];
    summaryCards[2].querySelector('.value').textContent = formatCurrency(tomorrow.revenue);
    summaryCards[2].querySelector('.sub').textContent = `${tomorrow.sales} vendas estimadas`;
}

// Processar dados para visualização
function processData(historicalData, predictionData) {
    // Processar histórico (exemplo simplificado)
    const historical = [
        { date: '01/06', sales: 42, revenue: 1520.80, top_product: 'Paracetamol', top_seller: 'Carlos' },
        { date: '02/06', sales: 38, revenue: 1420.50, top_product: 'Ibuprofeno', top_seller: 'Ana' },
        // ... outros dias históricos
    ];

    // Processar projeções
    const predictions = predictionData.predicoes.map(p => ({
        date: p.data,
        sales: p.vendas_previstas,
        revenue: parseFloat(p.receita_prevista.replace('R$ ', '').replace(',', '.'))
    }));

    return { historical, predictions };
}

// Inicializar dashboard
async function initDashboard() {
    updateCurrentDate();

    // Carregar dados iniciais
    const days = parseInt(document.getElementById('dias').value);
    const historicalData = await loadHistoricalData();
    const predictionData = await loadPredictions(days);

    if (!historicalData || !predictionData) {
        alert('Erro ao carregar dados. Verifique o backend.');
        return;
    }

    // Processar e exibir dados
    const { historical, predictions } = processData(historicalData, predictionData);
    renderSalesChart(historical, predictions);
    renderRevenueChart(historical, predictions);
    updateDataTable([...historical, ...predictions]);
    updateSummaryCards(historical, predictions);
}

// Event Listeners
predictionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const days = parseInt(document.getElementById('dias').value);
    await initDashboard();
});

historyFilter.addEventListener('change', async () => {
    await initDashboard();
});

// Iniciar quando carregar
document.addEventListener('DOMContentLoaded', initDashboard);
