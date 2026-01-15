let allData = [];
let historicalChart = null;
let projectionChart = null;

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

const formatNumber = (value) => {
    return new Intl.NumberFormat('pt-BR').format(value);
};

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

            let rawPrice = row['Preço'].replace('R$', '').trim();
            let precoUnitario = parseFloat(rawPrice);

            if (isNaN(precoUnitario)) precoUnitario = 0;
            row['Preço Unitário'] = precoUnitario;

            let quantidade = parseInt(row['Quantidade']) || 1;
            row['Quantidade'] = quantidade;

            row['Preço Total'] = precoUnitario * quantidade;

            allData.push(row);
        }

        console.log(`CSV carregado com sucesso: ${allData.length} registros`);
        initializeFilters();
        updateDashboard(allData);

    } catch (error) {
        console.error('Erro ao parsear CSV:', error);
        alert('Erro ao processar dados do CSV.');
    }
}

function getUniqueValues(data, column) {
    const values = data.map(row => row[column]).filter(v => v);
    return [...new Set(values)].sort();
}

function populateSelect(selectId, options, defaultText) {
    const select = document.getElementById(selectId);
    const currentSelection = select.value;
    select.innerHTML = `<option value="all">${defaultText}</option>`;
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        select.appendChild(opt);
    });
    if (options.includes(currentSelection)) {
        select.value = currentSelection;
    } else {
        select.value = 'all';
    }
    select.disabled = false;
}

function initializeFilters() {
    populateSelect('filterCidade', getUniqueValues(allData, 'Cidade'), 'Todas as Cidades');
    populateSelect('filterCategoria', getUniqueValues(allData, 'Categoria'), 'Todas as Categorias');
    populateSelect('filterMedicamento', getUniqueValues(allData, 'Medicamento'), 'Todos os Medicamentos');
    populateSelect('filterVendedor', getUniqueValues(allData, 'Vendedor'), 'Todos os Vendedores');
}

function applyFilters() {
    const cidade = document.getElementById('filterCidade').value;
    const categoria = document.getElementById('filterCategoria').value;
    const medicamento = document.getElementById('filterMedicamento').value;
    const vendedor = document.getElementById('filterVendedor').value;

    let filtered = allData;

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

function updateDashboard(data) {
    updateStats(data);
    updateCharts(data);
    updateTable(data); // Agora updateTable também receberá os dados brutos e fará sua própria agregação se necessário
    updateLastUpdateDate();
}

function updateStats(data) {
    const totalSales = data.length;
    const totalRevenue = data.reduce((sum, row) => sum + row['Preço Total'], 0);
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    const productCounts = {};
    data.forEach(row => {
        const prod = row['Medicamento'];
        productCounts[prod] = (productCounts[prod] || 0) + 1;
    });

    const topProduct = Object.keys(productCounts).length > 0
        ? Object.keys(productCounts).reduce((a, b) => productCounts[a] > productCounts[b] ? a : b)
        : '-';

    document.getElementById('totalSales').textContent = formatNumber(totalSales);
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('avgTicket').textContent = formatCurrency(avgTicket);
    document.getElementById('topProduct').textContent = topProduct;
}

// Função para agregar dados por período para os gráficos
function aggregateDataForCharts(data, period) {
    const aggregated = {};

    data.forEach(row => {
        const date = new Date(row['Data']);
        let key;

        if (period === 'daily') {
            key = row['Data']; // Mantém a data original
        } else if (period === 'weekly') {
            const startOfWeek = new Date(date);
            startOfWeek.setDate(date.getDate() - date.getDay());
            key = startOfWeek.toISOString().split('T')[0]; // Formato YYYY-MM-DD para ordenação
        } else if (period === 'monthly') {
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // Formato YYYY-MM
        }

        if (!aggregated[key]) {
            aggregated[key] = 0;
        }
        aggregated[key] += row['Preço Total'];
    });

    return aggregated;
}

function updateCharts(data) {
    const period = document.getElementById('filterPeriodo').value;
    const salesByPeriod = aggregateDataForCharts(data, period); // Usa a nova função de agregação para gráficos

    const sortedKeys = Object.keys(salesByPeriod).sort();
    const revenues = sortedKeys.map(key => salesByPeriod[key]);

    // Gráfico Histórico
    const ctx1 = document.getElementById('historicalChart');
    if (historicalChart) historicalChart.destroy();
    historicalChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: sortedKeys,
            datasets: [{
                label: 'Receita (R$)',
                data: revenues,
                borderColor: 'rgb(0, 72, 72)',
                backgroundColor: 'rgba(0, 72, 72, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true }
            },
            scales: {
                x: { // Adicionado para formatar o eixo X corretamente
                    type: 'time',
                    time: {
                        unit: period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month',
                        tooltipFormat: period === 'daily' ? 'dd/MM/yyyy' : period === 'weekly' ? 'dd/MM/yyyy' : 'MM/yyyy',
                        displayFormats: {
                            day: 'dd/MM',
                            week: 'dd/MM',
                            month: 'MM/yyyy'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Período'
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    }
                }
            }
        }
    });

    // Gráfico Projeção
    const lastRevenue = revenues[revenues.length - 1] || 0;
    const projectionSteps = 7; // Número de passos para a projeção (dias, semanas ou meses)
    const projectionLabels = [];
    const projectionData = [];

    for (let i = 1; i <= projectionSteps; i++) {
        let labelSuffix = '';
        if (period === 'daily') labelSuffix = 'd';
        else if (period === 'weekly') labelSuffix = 'sem';
        else if (period === 'monthly') labelSuffix = 'mês';
        projectionLabels.push(`+${i}${labelSuffix}`);
        projectionData.push(lastRevenue * (1 + Math.random() * 0.1));
    }

    const ctx2 = document.getElementById('projectionChart');
    if (projectionChart) projectionChart.destroy();
    projectionChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: projectionLabels,
            datasets: [{
                label: 'Projeção (R$)',
                data: projectionData,
                backgroundColor: 'rgba(0, 72, 72, 0.7)',
                borderColor: 'rgb(0, 72, 72)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    }
                }
            }
        }
    });
}

// NOVA FUNÇÃO: Agrega dados para a tabela
function aggregateDataForTable(data, period) {
    if (period === 'daily') {
        return data.slice(0, 500); // Retorna os dados brutos para o modo diário
    }

    const aggregated = {};
    data.forEach(row => {
        const date = new Date(row['Data']);
        let key;

        if (period === 'weekly') {
            const startOfWeek = new Date(date);
            startOfWeek.setDate(date.getDate() - date.getDay());
            key = `Semana de ${startOfWeek.toLocaleDateString('pt-BR')}`;
        } else if (period === 'monthly') {
            key = `${date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
        }

        if (!aggregated[key]) {
            aggregated[key] = {
                'Período': key,
                'Total de Vendas': 0,
                'Receita Total': 0,
                'Medicamentos Vendidos': new Set(),
                'Categorias Vendidas': new Set(),
                'Cidades': new Set(),
                'Vendedores': new Set()
            };
        }
        aggregated[key]['Total de Vendas'] += row['Quantidade'];
        aggregated[key]['Receita Total'] += row['Preço Total'];
        aggregated[key]['Medicamentos Vendidos'].add(row['Medicamento']);
        aggregated[key]['Categorias Vendidas'].add(row['Categoria']);
        aggregated[key]['Cidades'].add(row['Cidade']);
        aggregated[key]['Vendedores'].add(row['Vendedor']);
    });

    // Converte os Sets para strings para exibição na tabela
    return Object.values(aggregated).map(item => ({
        'Período': item['Período'],
        'Total de Vendas': item['Total de Vendas'],
        'Receita Total': item['Receita Total'],
        'Medicamentos Vendidos': Array.from(item['Medicamentos Vendidos']).join(', '),
        'Categorias Vendidas': Array.from(item['Categorias Vendidas']).join(', '),
        'Cidades': Array.from(item['Cidades']).join(', '),
        'Vendedores': Array.from(item['Vendedores']).join(', ')
    }));
}


function updateTable(data) {
    const tbody = document.getElementById('salesTableBody');
    tbody.innerHTML = '';

    const period = document.getElementById('filterPeriodo').value;
    const aggregatedTableData = aggregateDataForTable(data, period);

    // Atualiza o título da tabela
    const tableTitleElement = document.querySelector('.table-section h3');
    if (tableTitleElement) {
        tableTitleElement.textContent = `📋 Detalhamento ${period === 'daily' ? 'Diário' : period === 'weekly' ? 'Semanal' : 'Mensal'} (Máximo 500 linhas)`;
    }

    // Atualiza o cabeçalho da tabela
    const thead = document.querySelector('#salesTable thead tr');
    thead.innerHTML = ''; // Limpa o cabeçalho existente

    if (period === 'daily') {
        thead.innerHTML = `
            <th>Data</th>
            <th>Medicamento</th>
            <th>Categoria</th>
            <th>Quantidade</th>
            <th>Preço Unitário</th>
            <th>Preço Total</th>
            <th>Cidade</th>
            <th>Vendedor</th>
        `;
        aggregatedTableData.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row['Data']}</td>
                <td>${row['Medicamento']}</td>
                <td>${row['Categoria']}</td>
                <td>${row['Quantidade']}</td>
                <td>${formatCurrency(row['Preço Unitário'])}</td>
                <td>${formatCurrency(row['Preço Total'])}</td>
                <td>${row['Cidade']}</td>
                <td>${row['Vendedor']}</td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        thead.innerHTML = `
            <th>Período</th>
            <th>Total de Vendas</th>
            <th>Receita Total</th>
            <th>Medicamentos Vendidos</th>
            <th>Categorias Vendidas</th>
            <th>Cidades</th>
            <th>Vendedores</th>
        `;
        aggregatedTableData.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row['Período']}</td>
                <td>${formatNumber(row['Total de Vendas'])}</td>
                <td>${formatCurrency(row['Receita Total'])}</td>
                <td>${row['Medicamentos Vendidos']}</td>
                <td>${row['Categorias Vendidas']}</td>
                <td>${row['Cidades']}</td>
                <td>${row['Vendedores']}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}


function updateLastUpdateDate() {
    const lastUpdateDateElement = document.getElementById('lastUpdateDate');
    if (lastUpdateDateElement) {
        const now = new Date();
        const options = {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        };
        lastUpdateDateElement.textContent = now.toLocaleDateString('pt-BR', options);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado. Iniciando...');
    loadCSV();

    document.getElementById('filterCidade').addEventListener('change', function() {
        applyFilters();
        updateDependentFilters();
    });

    document.getElementById('filterCategoria').addEventListener('change', function() {
        applyFilters();
        updateDependentFilters();
    });

    document.getElementById('filterMedicamento').addEventListener('change', function() {
        applyFilters();
        updateDependentFilters();
    });

    document.getElementById('filterVendedor').addEventListener('change', function() {
        applyFilters();
        updateDependentFilters();
    });

    document.getElementById('filterPeriodo').addEventListener('change', function() {
        applyFilters(); // Re-aplica os filtros para atualizar o dashboard com o novo período
    });

    document.getElementById('clearBtn').addEventListener('click', function() {
        document.getElementById('filterCidade').value = 'all';
        document.getElementById('filterCategoria').value = 'all';
        document.getElementById('filterMedicamento').value = 'all';
        document.getElementById('filterVendedor').value = 'all';
        document.getElementById('filterPeriodo').value = 'daily'; // Reseta o período para diário

        initializeFilters();
        updateDashboard(allData);
    });

    function updateDependentFilters() {
        const selectedCidade = document.getElementById('filterCidade').value;
        const selectedCategoria = document.getElementById('filterCategoria').value;
        const selectedMedicamento = document.getElementById('filterMedicamento').value;
        const selectedVendedor = document.getElementById('filterVendedor').value;

        let filteredForNextDropdowns = allData;

        if (selectedCidade !== 'all') {
            filteredForNextDropdowns = filteredForNextDropdowns.filter(row => row['Cidade'] === selectedCidade);
        }
        populateSelect('filterCategoria', getUniqueValues(filteredForNextDropdowns, 'Categoria'), 'Todas as Categorias');
        if (selectedCategoria !== 'all' && getUniqueValues(filteredForNextDropdowns, 'Categoria').includes(selectedCategoria)) {
            document.getElementById('filterCategoria').value = selectedCategoria;
        } else {
            document.getElementById('filterCategoria').value = 'all';
        }

        if (selectedCategoria !== 'all') {
            filteredForNextDropdowns = filteredForNextDropdowns.filter(row => row['Categoria'] === selectedCategoria);
        }
        populateSelect('filterMedicamento', getUniqueValues(filteredForNextDropdowns, 'Medicamento'), 'Todos os Medicamentos');
        if (selectedMedicamento !== 'all' && getUniqueValues(filteredForNextDropdowns, 'Medicamento').includes(selectedMedicamento)) {
            document.getElementById('filterMedicamento').value = selectedMedicamento;
        } else {
            document.getElementById('filterMedicamento').value = 'all';
        }

        if (selectedMedicamento !== 'all') {
            filteredForNextDropdowns = filteredForNextDropdowns.filter(row => row['Medicamento'] === selectedMedicamento);
        }
        populateSelect('filterVendedor', getUniqueValues(filteredForNextDropdowns, 'Vendedor'), 'Todos os Vendedores');
        if (selectedVendedor !== 'all' && getUniqueValues(filteredForNextDropdowns, 'Vendedor').includes(selectedVendedor)) {
            document.getElementById('filterVendedor').value = selectedVendedor;
        } else {
            document.getElementById('filterVendedor').value = 'all';
        }
    }
});
