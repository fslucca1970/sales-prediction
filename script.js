let allData = [];
let historicalChart = null;
let projectionChart = null;

// Carregar CSV do GitHub
async function loadCSV() {
    try {
        const response = await fetch('vendas_farmacia.csv');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
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

    if (lines.length < 2) {
        console.error('CSV vazio ou inválido');
        return;
    }

    // Detecta o separador (tabulação ou vírgula)
    const firstLine = lines[0];
    const separator = firstLine.includes('\t') ? '\t' : ',';

    const headers = lines[0].split(separator).map(h => h.trim().replace(/"/g, ''));

    allData = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(separator).map(v => v.trim().replace(/"/g, ''));
        const row = {};

        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });

        allData.push(row);
    }

    console.log("Dados carregados (allData):", allData);
    console.log("Total de registros:", allData.length);

    if (allData.length === 0) {
        alert('Nenhum dado foi carregado do CSV.');
        return;
    }

    updateDashboard(allData);

    // Inicializa o dropdown
    const filterTypeElement = document.getElementById('filterType');
    if (filterTypeElement) {
        populateFilterDropdown(filterTypeElement.value);
    }
}

// Atualizar dashboard
function updateDashboard(data) {
    if (!data || data.length === 0) {
        console.warn('updateDashboard chamado com dados vazios');
        return;
    }

    updateStats(data);
    renderTable(data);
    renderCharts(data);
    updateCurrentDate();
}

// Atualizar estatísticas
function updateStats(data) {
    const totalSales = data.length;

    const totalRevenue = data.reduce((sum, row) => {
        if (!row.preco) return sum;

        const cleanPrice = row.preco.replace(/R\$\s*/g, '').replace(/\s/g, '').replace(',', '.');
        const price = parseFloat(cleanPrice);

        return sum + (isNaN(price) ? 0 : price);
    }, 0);

    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    const products = {};
    data.forEach(row => {
        if (row.nome_produto) {
            products[row.nome_produto] = (products[row.nome_produto] || 0) + 1;
        }
    });

    const topProduct = Object.keys(products).length > 0 
        ? Object.keys(products).reduce((a, b) => products[a] > products[b] ? a : b)
        : '-';

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

    data.forEach(row => {
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
    const salesByDate = {};

    data.forEach(row => {
        const date = row.data_venda || 'Sem data';
        salesByDate[date] = (salesByDate[date] || 0) + 1;
    });

    const sortedDates = Object.keys(salesByDate).sort();
    const historicalLabels = sortedDates;
    const historicalData = sortedDates.map(date => salesByDate[date]);

    // Gráfico Histórico
    const ctx1 = document.getElementById('historicalChart');
    if (ctx1) {
        if (historicalChart) historicalChart.destroy();

        historicalChart = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: historicalLabels,
                datasets: [{
                    label: 'Vendas Diárias',
                    data: historicalData,
                    backgroundColor: 'rgba(0, 72, 18, 0.2)',
                    borderColor: 'rgb(0, 72, 18)',
                    borderWidth: 2,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { position: 'top' } }
            }
        });
    }

    // Projeção (média dos últimos 7 dias)
    const lastSevenDays = historicalData.slice(-7);
    const avgSales = lastSevenDays.length > 0 
        ? lastSevenDays.reduce((a, b) => a + b, 0) / lastSevenDays.length 
        : 0;

    const projectionLabels = ['Dia 1', 'Dia 2', 'Dia 3', 'Dia 4', 'Dia 5', 'Dia 6', 'Dia 7'];
    const projectionData = Array(7).fill(Math.round(avgSales));

    // Gráfico de Projeção
    const ctx2 = document.getElementById('projectionChart');
    if (ctx2) {
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
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { position: 'top' } }
            }
        });
    }
}

// Preencher dropdown dinâmico
function populateFilterDropdown(filterType) {
    const dropdown = document.getElementById('filterValue');

    if (!dropdown) {
        console.error('Elemento filterValue não encontrado');
        return;
    }

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

    if (!field || allData.length === 0) {
        return;
    }

    const uniqueValues = [...new Set(
        allData
            .map(row => row[field])
            .filter(value => value && value.trim() !== '')
    )].sort();

    uniqueValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        dropdown.appendChild(option);
    });
}

// Atualizar data
function updateCurrentDate() {
    const currentDateEl = document.getElementById('currentDate');
    if (currentDateEl) {
        const now = new Date();
        currentDateEl.textContent = now.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    }
}

// Inicialização - TODOS os Event Listeners dentro do DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Carrega o CSV
    loadCSV();

    // Event listener para mudança no tipo de filtro
    const filterTypeEl = document.getElementById('filterType');
    if (filterTypeEl) {
        filterTypeEl.addEventListener('change', (e) => {
            populateFilterDropdown(e.target.value);
        });
    }

    // Event listener para botão de filtrar
    const filterBtn = document.getElementById('filterBtn');
    if (filterBtn) {
        filterBtn.addEventListener('click', () => {
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

            console.log(`Filtrado por ${filterType} = ${filterValue}:`, filtered.length, 'registros');

            updateDashboard(filtered);
        });
    }

    // Event listener para botão de limpar
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const filterTypeEl = document.getElementById('filterType');
            const filterValueEl = document.getElementById('filterValue');

            if (filterTypeEl) filterTypeEl.value = 'all';
            if (filterValueEl) filterValueEl.classList.add('hidden');

            updateDashboard(allData);
        });
    }
});
