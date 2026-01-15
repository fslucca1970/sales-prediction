let allData = [];
let historicalChart = null;
let projectionChart = null;

// Funções de formatação
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

const formatNumber = (value) => {
    return new Intl.NumberFormat('pt-BR').format(value);
};

// Carregar CSV
async function loadCSV() {
    try {
        const response = await fetch('vendas_farmacia.csv');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const csv = await response.text();
        parseCSV(csv);
    } catch (error) {
        console.error('Erro ao carregar CSV:', error);
        alert('Erro ao carregar dados.');
    }
}

// Parsear CSV
function parseCSV(csv) {
    try {
        const lines = csv.trim().split('\n');
        if (lines.length < 2) {
            alert('CSV vazio ou inválido.');
            return;
        }

        const separator = lines[0].includes('\t') ? '\t' : ',';
        const headers = lines[0].split(separator).map(h => h.trim().replace(/"/g, ''));

        allData = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const values = lines[i].split(separator).map(v => v.trim().replace(/"/g, ''));
            const row = {};

            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });

            // Converter Preço para número
            let precoUnitario = parseFloat(row['Preço'].replace('R$', '').replace('.', '').replace(',', '.').trim());
            if (isNaN(precoUnitario)) precoUnitario = 0;
            row['Preço Unitário'] = precoUnitario;

            // Converter Quantidade para número
            let quantidade = parseInt(row['Quantidade']) || 1;
            row['Quantidade'] = quantidade;

            // Calcular Preço Total
            row['Preço Total'] = precoUnitario * quantidade;

            allData.push(row);
        }

        console.log('CSV carregado com sucesso:', allData.length, 'registros');

        // Inicializar
        initializeFilters();
        updateDashboard(allData);

    } catch (error) {
        console.error('Erro ao fazer parsing do CSV:', error);
        alert('Erro ao fazer parsing do CSV.');
    }
}

// Obter valores únicos
function getUniqueValues(data, field) {
    const values = new Set();
    data.forEach(row => {
        if (row[field]) values.add(row[field]);
    });
    return Array.from(values).sort();
}

// Inicializar filtros
function initializeFilters() {
    const cidades = getUniqueValues(allData, 'Cidade');
    populateSelect('filterCidade', cidades, 'Todas as Cidades');

    document.getElementById('filterCategoria').disabled = true;
    document.getElementById('filterMedicamento').disabled = true;
    document.getElementById('filterVendedor').disabled = true;
}

// Preencher select
function populateSelect(selectId, values, defaultText) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = `<option value="all">${defaultText}</option>`;
    values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });
}

// Aplicar filtros
function applyFilters() {
    let filtered = allData;

    const cidade = document.getElementById('filterCidade').value;
    const categoria = document.getElementById('filterCategoria').value;
    const medicamento = document.getElementById('filterMedicamento').value;
    const vendedor = document.getElementById('filterVendedor').value;

    if (cidade !== 'all') {
        filtered = filtered.filter(row => row['Cidade'] === cidade);
    }
    if (categoria !== 'all') {
        filtered = filtered.filter(row => row['Categoria'] === categoria);
    }
    if (medicamento !== 'all') {
        filtered = filtered.filter(row => row['Medicamento'] === medicamento);
    }
    if (vendedor !== 'all') {
        filtered = filtered.filter(row => row['Vendedor'] === vendedor);
    }

    updateDashboard(filtered);
}

// Atualizar Dashboard
function updateDashboard(data) {
    updateStats(data);
    renderCharts(data);
    renderTable(data);
    updateLastUpdateDate();
}

// Atualizar Estatísticas
function updateStats(data) {
    const totalSales = data.length;
    const totalRevenue = data.reduce((sum, row) => sum + row['Preço Total'], 0);
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    const productSales = {};
    data.forEach(row => {
        productSales[row['Medicamento']] = (productSales[row['Medicamento']] || 0) + row['Preço Total'];
    });

    let topProduct = '-';
    let maxRevenue = 0;
    for (const product in productSales) {
        if (productSales[product] > maxRevenue) {
            maxRevenue = productSales[product];
            topProduct = product;
        }
    }

    document.getElementById('totalSales').textContent = formatNumber(totalSales);
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('avgTicket').textContent = formatCurrency(avgTicket);
    document.getElementById('topProduct').textContent = topProduct;
}

// Renderizar Gráficos
function renderCharts(data) {
    if (historicalChart) historicalChart.destroy();
    if (projectionChart) projectionChart.destroy();

    const dailySales = {};
    data.forEach(row => {
        const date = row['Data'];
        dailySales[date] = (dailySales[date] || 0) + row['Preço Total'];
    });

    const sortedDates = Object.keys(dailySales).sort();
    const historicalData = sortedDates.map(date => dailySales[date]);

    // Gráfico Histórico
    const historicalCtx = document.getElementById('historicalChart');
    if (historicalCtx) {
        historicalChart = new Chart(historicalCtx, {
            type: 'line',
            data: {
                labels: sortedDates,
                datasets: [{
                    label: 'Receita Diária',
                    data: historicalData,
                    borderColor: 'rgb(0, 72, 72)',
                    backgroundColor: 'rgba(0, 72, 72, 0.2)',
                    tension: 0.1,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                            }
                        }
                    }
                }
            }
        });
    }

    // Gráfico Projeção
    const last7Days = historicalData.slice(-7);
    const avgLast7 = last7Days.length > 0 ? last7Days.reduce((a, b) => a + b, 0) / last7Days.length : 0;

    const projectionLabels = [];
    const projectionData = [];
    let lastDate = new Date(sortedDates[sortedDates.length - 1]);

    for (let i = 1; i <= 7; i++) {
        lastDate.setDate(lastDate.getDate() + 1);
        projectionLabels.push(lastDate.toISOString().split('T')[0]);
        projectionData.push(avgLast7 * (1 + (Math.random() - 0.5) * 0.1));
    }

    const projectionCtx = document.getElementById('projectionChart');
    if (projectionCtx) {
        projectionChart = new Chart(projectionCtx, {
            type: 'bar',
            data: {
                labels: projectionLabels,
                datasets: [{
                    label: 'Receita Projetada',
                    data: projectionData,
                    backgroundColor: 'rgba(0, 72, 72, 0.6)',
                    borderColor: 'rgb(0, 72, 72)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                            }
                        }
                    }
                }
            }
        });
    }
}

// Renderizar Tabela
function renderTable(data) {
    const tableBody = document.getElementById('salesTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    const recordsToShow = Math.min(data.length, 500);
    const sortedData = data.sort((a, b) => new Date(b['Data']) - new Date(a['Data']));

    for (let i = 0; i < recordsToShow; i++) {
        const rowData = sortedData[i];
        const row = tableBody.insertRow();

        row.insertCell().textContent = rowData['Data'];
        row.insertCell().textContent = rowData['Medicamento'];
        row.insertCell().textContent = rowData['Categoria'];
        row.insertCell().textContent = formatNumber(rowData['Quantidade']);
        row.insertCell().textContent = formatCurrency(rowData['Preço Unitário']);
        row.insertCell().textContent = formatCurrency(rowData['Preço Total']);
        row.insertCell().textContent = rowData['Cidade'];
        row.insertCell().textContent = rowData['Vendedor'];
    }
}

// Atualizar data
function updateLastUpdateDate() {
    const el = document.getElementById('lastUpdateDate');
    if (el) {
        const now = new Date();
        el.textContent = now.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado. Iniciando...');
    loadCSV();

    // Filtro Cidade
    document.getElementById('filterCidade').addEventListener('change', function() {
        let filtered = allData;
        if (this.value !== 'all') {
            filtered = allData.filter(row => row['Cidade'] === this.value);
        }

        const categorias = getUniqueValues(filtered, 'Categoria');
        populateSelect('filterCategoria', categorias, 'Todas as Categorias');
        document.getElementById('filterCategoria').disabled = false;

        document.getElementById('filterMedicamento').innerHTML = '<option value="all">Todos os Medicamentos</option>';
        document.getElementById('filterMedicamento').disabled = true;
        document.getElementById('filterVendedor').innerHTML = '<option value="all">Todos os Vendedores</option>';
        document.getElementById('filterVendedor').disabled = true;

        applyFilters();
    });

    // Filtro Categoria
    document.getElementById('filterCategoria').addEventListener('change', function() {
        const cidade = document.getElementById('filterCidade').value;
        let filtered = allData;

        if (cidade !== 'all') {
            filtered = filtered.filter(row => row['Cidade'] === cidade);
        }
        if (this.value !== 'all') {
            filtered = filtered.filter(row => row['Categoria'] === this.value);
        }

        const medicamentos = getUniqueValues(filtered, 'Medicamento');
        populateSelect('filterMedicamento', medicamentos, 'Todos os Medicamentos');
        document.getElementById('filterMedicamento').disabled = false;

        document.getElementById('filterVendedor').innerHTML = '<option value="all">Todos os Vendedores</option>';
        document.getElementById('filterVendedor').disabled = true;

        applyFilters();
    });

    // Filtro Medicamento
    document.getElementById('filterMedicamento').addEventListener('change', function() {
        const cidade = document.getElementById('filterCidade').value;
        const categoria = document.getElementById('filterCategoria').value;
        let filtered = allData;

        if (cidade !== 'all') {
            filtered = filtered.filter(row => row['Cidade'] === cidade);
        }
        if (categoria !== 'all') {
            filtered = filtered.filter(row => row['Categoria'] === categoria);
        }
        if (this.value !== 'all') {
            filtered = filtered.filter(row => row['Medicamento'] === this.value);
        }

        const vendedores = getUniqueValues(filtered, 'Vendedor');
        populateSelect('filterVendedor', vendedores, 'Todos os Vendedores');
        document.getElementById('filterVendedor').disabled = false;

        applyFilters();
    });

    // Filtro Vendedor
    document.getElementById('filterVendedor').addEventListener('change', function() {
        applyFilters();
    });

    // Botão Limpar
    document.getElementById('clearBtn').addEventListener('click', function() {
        document.getElementById('filterCidade').value = 'all';
        document.getElementById('filterCategoria').value = 'all';
        document.getElementById('filterMedicamento').value = 'all';
        document.getElementById('filterVendedor').value = 'all';

        document.getElementById('filterCategoria').disabled = true;
        document.getElementById('filterMedicamento').disabled = true;
        document.getElementById('filterVendedor').disabled = true;

        updateDashboard(allData);
    });
});
