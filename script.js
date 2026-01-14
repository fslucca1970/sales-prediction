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
    const separatorRegex = /\t|,/;

    const headers = lines[0].split(separatorRegex).map(h => h.trim().replace(/"/g, ''));

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(separatorRegex).map(v => v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index];
        });
        allData.push(row);
    }

    updateDashboard(allData);
    populateFilterDropdown('medicamento'); // Preenche o dropdown inicial
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
    const topProduct = Object.keys(products).length > 0 ? Object.keys(products).reduce((a, b) => 
        products[a] > products[b] ? a : b
    ) : '-';

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
            <td>${row.data_venda || '-'}</td>
            <td>${row.nome_produto || '-'}</td>
            <td>${row.categoria || '-'}</td>
            <td>${row.unidade || '-'}</td>
            <td>${row.nome_vendedor || '-'}</td>
            <td>${row.preco || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Renderizar gráficos
function renderCharts(data) {
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

    const ctx1 = document.getElementById('historicalChart').getContext('2d');
    if (historicalChart) historicalChart.destroy();
    historicalChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Vendas por Dia',
                data: counts,
                borderColor: 'rgb(0, 72, 18)',
                backgroundColor: 'rgba(0, 72, 18, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'top' } } }
    });

    const avgSales = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    const projectionDays = 7;
    const projectionLabels = [];
    const projectionData = [];

    const lastDate = dates.length > 0 ? new Date(dates[dates.length - 1]) : new Date();
    for (let i = 1; i <= projectionDays; i++) {
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + i);
        projectionLabels.push(nextDate.toLocaleDateString('pt-BR'));
        projectionData.push(Math.round(avgSales * (0.95 + Math.random() * 0.1)));
    }

    const ctx2 = document.getElementById('projectionChart').getContext('2d');
    if (projectionChart) projectionChart.destroy();
    projectionChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: projectionLabels,
            datasets: [{
                label: 'Vendas Projetadas',
                data: projectionData,
                backgroundColor: 'rgba(0, 100, 30, 0.7)',
                borderColor: 'rgb(0, 72, 18)',
                borderWidth: 1
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'top' } } }
    });
}

// Preencher dropdown dinâmico
function populateFilterDropdown(filterType) {
    const dropdown = document.getElementById('filterValue');
    dropdown.innerHTML = '<option value="">Escolha uma opção...</option>';

    if (filterType === 'all') {
        dropdown.classList.add('hidden');
        return;
    }

    dropdown.classList.remove('hidden');

    const fieldMap = {
        'medicamento': 'nome_produto',
        'cidade': 'unidade',
        'categoria': 'categoria',
        'vendedor': 'nome_vendedor'
    };

    const field = fieldMap[filterType];
    const uniqueValues = [...new Set(allData.map(row => row[field]))].sort();

    uniqueValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        dropdown.appendChild(option);
    });
}

// Event Listeners
document.getElementById('filterType').addEventListener('change', (e) => {
    populateFilterDropdown(e.target.value);
});

document.getElementById('filterBtn').addEventListener('click', () => {
    const filterType = document.getElementById('filterType').value;
    const filterValue = document.getElementById('filterValue').value;

    if (filterType === 'all' || !filterValue) {
        updateDashboard(allData);
        return;
    }

    const fieldMap = {
        'medicamento': 'nome_produto',
        'cidade': 'unidade',
        'categoria': 'categoria',
        'vendedor': 'nome_vendedor'
    };

    const field = fieldMap[filterType];
    const filtered = allData.filter(row => row[field] === filterValue);

    updateDashboard(filtered);
});

document.getElementById('clearBtn').addEventListener('click', () => {
    document.getElementById('filterType').value = 'all';
    document.getElementById('filterValue').classList.add('hidden');
    updateDashboard(allData);
});

// Atualizar data
function updateCurrentDate() {
    const now = new Date();
    document.getElementById('currentDate').textContent = 
        now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Iniciar
document.addEventListener('DOMContentLoaded', loadCSV);
