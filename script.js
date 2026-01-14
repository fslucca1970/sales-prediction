let allData = [];
let historicalChart = null;
let projectionChart = null;

// Carregar CSV do GitHub
async function loadCSV() {
    try {
        const response = await fetch('vendas_farmacia.csv');
        const csv = await response.text();
        parseCSV(csv);
    } catch (error) {
        console.error('Erro ao carregar CSV:', error);
        alert('Erro ao carregar dados. Verifique se o arquivo CSV existe.');
    }
}

// Parsear CSV
function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index];
        });
        allData.push(row);
    }

    updateDashboard(allData);
}

// Atualizar dashboard
function updateDashboard(data) {
    updateStats(data);
    renderTable(data);
    renderCharts(data);
    updateCurrentDate();
}

// Atualizar estatísticas
function updateStats(data) {
    const totalSales = data.length;
    const totalRevenue = data.reduce((sum, row) => {
        const price = parseFloat(row.preco.replace('R$ ', '').replace(',', '.'));
        return sum + (isNaN(price) ? 0 : price);
    }, 0);
    const avgTicket = totalRevenue / totalSales;

    const products = {};
    data.forEach(row => {
        products[row.nome_produto] = (products[row.nome_produto] || 0) + 1;
    });
    const topProduct = Object.keys(products).reduce((a, b) => 
        products[a] > products[b] ? a : b
    );

    document.getElementById('totalSales').textContent = totalSales;
    document.getElementById('totalRevenue').textContent = 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue);
    document.getElementById('avgTicket').textContent = 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(avgTicket);
    document.getElementById('topProduct').textContent = topProduct;
}

// Renderizar tabela
function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    data.slice(0, 50).forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.data_venda}</td>
            <td>${row.nome_produto}</td>
            <td>${row.categoria}</td>
            <td>${row.unidade}</td>
            <td>${row.nome_vendedor}</td>
            <td>${row.preco}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Renderizar gráficos
function renderCharts(data) {
    // Agrupar por data
    const byDate = {};
    data.forEach(row => {
        if (!byDate[row.data_venda]) {
            byDate[row.data_venda] = { count: 0, revenue: 0 };
        }
        byDate[row.data_venda].count++;
        const price = parseFloat(row.preco.replace('R$ ', '').replace(',', '.'));
        byDate[row.data_venda].revenue += isNaN(price) ? 0 : price;
    });

    const dates = Object.keys(byDate).sort();
    const counts = dates.map(d => byDate[d].count);
    const revenues = dates.map(d => byDate[d].revenue);

    // Gráfico histórico
    const ctx1 = document.getElementById('historicalChart').getContext('2d');
    if (historicalChart) historicalChart.destroy();
    historicalChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Vendas por Dia',
                data: counts,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'top' } } }
    });

    // Projeção simples (média móvel)
    const avgSales = counts.reduce((a, b) => a + b, 0) / counts.length;
    const projectionDays = 7;
    const projectionLabels = [];
    const projectionData = [];

    const lastDate = new Date(dates[dates.length - 1]);
    for (let i = 1; i <= projectionDays; i++) {
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + i);
        projectionLabels.push(nextDate.toLocaleDateString('pt-BR'));
        projectionData.push(Math.round(avgSales * (0.95 + Math.random() * 0.1)));
    }

    // Gráfico projeção
    const ctx2 = document.getElementById('projectionChart').getContext('2d');
    if (projectionChart) projectionChart.destroy();
    projectionChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: projectionLabels,
            datasets: [{
                label: 'Vendas Projetadas',
                data: projectionData,
                backgroundColor: 'rgba(231, 76, 60, 0.7)',
                borderColor: '#e74c3c',
                borderWidth: 1
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'top' } } }
    });
}

// Filtrar dados
document.getElementById('filterBtn').addEventListener('click', () => {
    const filterType = document.getElementById('filterType').value;
    const filterValue = document.getElementById('filterValue').value.toLowerCase();

    if (filterType === 'all' || !filterValue) {
        updateDashboard(allData);
        return;
    }

    const filtered = allData.filter(row => {
        const field = row[filterType === 'medicamento' ? 'nome_produto' : 
                         filterType === 'cidade' ? 'unidade' :
                         filterType === 'categoria' ? 'categoria' :
                         'nome_vendedor'];
        return field.toLowerCase().includes(filterValue);
    });

    updateDashboard(filtered);
});

// Atualizar data
function updateCurrentDate() {
    const now = new Date();
    document.getElementById('currentDate').textContent = 
        now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Iniciar
document.addEventListener('DOMContentLoaded', loadCSV);
