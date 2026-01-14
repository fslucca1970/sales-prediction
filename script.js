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
        alert('Erro ao carregar dados. Verifique se o arquivo CSV existe e está no formato correto.');
    }
}

// Parsear CSV
function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    // Regex mais robusta para separar por tabulação ou vírgula, e ignorar espaços extras
    const separatorRegex = /[\t,]+/; 

    const headers = lines[0].split(separatorRegex).map(h => h.trim().replace(/"/g, ''));

    // Limpa allData antes de preencher novamente
    allData = []; 

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(separatorRegex).map(v => v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index];
        });
        allData.push(row);
    }

    // Log para verificar se allData foi preenchido corretamente
    console.log("Dados carregados (allData):", allData); 

    updateDashboard(allData);
    // Inicializa o dropdown com base no filtro padrão (Todos os dados ou Medicamento)
    // Se 'all' for o padrão, o dropdown de valores ficará oculto até que um filtro específico seja escolhido.
    populateFilterDropdown(document.getElementById('filterType').value);
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
        // CORREÇÃO AQUI: Garante que o preço seja parseado corretamente
        // Remove "R$", espaços e substitui vírgula por ponto para parseFloat
        const price = parseFloat(row.preco ? row.preco.replace('R$', '').replace(/\s/g, '').replace(',', '.') : 0);
        return sum + (isNaN(price) ? 0 : price);
    }, 0);
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0; // Evita divisão por zero

    const products = {};
    data.forEach(row => {
        if (row.nome_produto) { // Garante que nome_produto exista
            products[row.nome_produto] = (products[row.nome_produto] || 0) + 1;
        }
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

    // data.slice(0, 50).forEach(row => { // Limita a 50 linhas para não sobrecarregar a visualização
    data.forEach(row => { // Mostra todas as linhas por padrão, você pode ajustar o slice se quiser limitar
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
        if (row.data_venda) { // Garante que data_venda exista
            if (!byDate[row.data_venda]) {
                byDate[row.data_venda] = { count: 0, revenue: 0 };
            }
            byDate[row.data_venda].count++;
            // CORREÇÃO AQUI: Garante que o preço seja parseado corretamente para os gráficos
            const price = parseFloat(row.preco ? row.preco.replace('R$', '').replace(/\s/g, '').replace(',', '.') : 0);
            byDate[row.data_venda].revenue += isNaN(price) ? 0 : price;
        }
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
                borderColor: 'rgb(0, 72, 18)', // Cor do gráfico histórico
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
                backgroundColor: 'rgba(0, 100, 30, 0.7)', // Cor do gráfico de projeção
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
        'cidade': 'unidade', // Nome da coluna para cidade
        'categoria': 'categoria',
        'vendedor': 'nome_vendedor'
    };

    const field = fieldMap[filterType];

    // Garante que 'field' exista e que allData tenha dados antes de tentar mapear
    const uniqueValues = allData.length > 0 && field 
        ? [...new Set(allData.map(row => row[field]).filter(value => value !== undefined && value !== null && value !== ''))].sort() 
        : [];

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
    const filterValue = document.getElementById('filterValue').value; // Pega o valor do dropdown

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
