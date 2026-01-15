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

// Função auxiliar para parsear data DD/MM/YYYY de forma robusta
function parseDateString(dateString) {
    const parts = dateString.split('/');
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Mês é 0-indexado
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
    }
    return new Date('Invalid Date'); // Retorna data inválida se o formato não for o esperado
}

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

            // Usa a função robusta para parsear a data
            row['ParsedDate'] = parseDateString(row['Data']);

            // Verifica se a data é válida
            if (isNaN(row['ParsedDate'].getTime())) {
                console.warn(`Data inválida encontrada e ignorada: ${row['Data']}`);
                continue; // Pula esta linha se a data for inválida
            }

            let rawPrice = row['Preço'].replace('R$', '').trim();
            // Substitui vírgula por ponto para garantir que parseFloat funcione corretamente
            rawPrice = rawPrice.replace('.', '').replace(',', '.'); 
            let precoUnitario = parseFloat(rawPrice);
            if (isNaN(precoUnitario)) precoUnitario = 0;
            row['Preço Unitário'] = precoUnitario;

            let quantidade = parseInt(row['Quantidade']) || 1;
            row['Quantidade'] = quantidade;
            row['Preço Total'] = precoUnitario * quantidade;

            allData.push(row);
        }

        console.log(`CSV carregado com sucesso: ${allData.length} registros`);
        initializeFilters(); // Inicializa os filtros com todos os dados
        updateDashboard(allData); // Atualiza o dashboard com todos os dados
        updateDependentFilters(); // Garante que os filtros dependentes sejam populados corretamente
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
    const currentSelection = select.value; // Mantém a seleção atual
    select.innerHTML = `<option value="all">${defaultText}</option>`;
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        select.appendChild(opt);
    });
    // Tenta restaurar a seleção anterior, se ainda for uma opção válida
    if (options.includes(currentSelection)) {
        select.value = currentSelection;
    } else {
        select.value = 'all'; // Volta para 'all' se a opção anterior não for mais válida
    }
    // Habilita o select se houver opções além do default
    select.disabled = options.length === 0;
}

function initializeFilters() {
    populateSelect('filterCidade', getUniqueValues(allData, 'Cidade'), 'Todas as Cidades');
    // Os outros filtros dependentes serão populados por updateDependentFilters
    document.getElementById('filterCategoria').disabled = true;
    document.getElementById('filterMedicamento').disabled = true;
    document.getElementById('filterVendedor').disabled = true;

    // Adiciona event listeners para os filtros
    document.getElementById('filterCidade').addEventListener('change', applyFilters);
    document.getElementById('filterCategoria').addEventListener('change', applyFilters);
    document.getElementById('filterMedicamento').addEventListener('change', applyFilters);
    document.getElementById('filterVendedor').addEventListener('change', applyFilters);
    document.getElementById('filterPeriodo').addEventListener('change', applyFilters);
    document.getElementById('projectionMetric').addEventListener('change', applyFilters); // Event listener para a métrica da projeção
    document.getElementById('clearBtn').addEventListener('click', clearFilters);
}

function applyFilters() {
    let filteredData = allData;

    const selectedCidade = document.getElementById('filterCidade').value;
    const selectedCategoria = document.getElementById('filterCategoria').value;
    const selectedMedicamento = document.getElementById('filterMedicamento').value;
    const selectedVendedor = document.getElementById('filterVendedor').value;

    if (selectedCidade !== 'all') {
        filteredData = filteredData.filter(row => row['Cidade'] === selectedCidade);
    }
    if (selectedCategoria !== 'all') {
        filteredData = filteredData.filter(row => row['Categoria'] === selectedCategoria);
    }
    if (selectedMedicamento !== 'all') {
        filteredData = filteredData.filter(row => row['Medicamento'] === selectedMedicamento);
    }
    if (selectedVendedor !== 'all') {
        filteredData = filteredData.filter(row => row['Vendedor'] === selectedVendedor);
    }

    updateDashboard(filteredData);
    updateDependentFilters(); // Atualiza os filtros dependentes após aplicar os filtros principais
}

function clearFilters() {
    document.getElementById('filterCidade').value = 'all';
    document.getElementById('filterCategoria').value = 'all';
    document.getElementById('filterMedicamento').value = 'all';
    document.getElementById('filterVendedor').value = 'all';
    document.getElementById('filterPeriodo').value = 'daily'; // Volta para diário
    document.getElementById('projectionMetric').value = 'revenue'; // Volta para receita
    applyFilters();
}

function updateDashboard(data) {
    updateStats(data);

    const period = document.getElementById('filterPeriodo').value;
    const groupedData = aggregateDataByPeriod(data, period);

    updateCharts(groupedData, period);
    updateTable(data, groupedData, period); // Passa os dados originais e os agrupados
}

function updateStats(data) {
    const totalSales = data.length;
    const totalRevenue = data.reduce((sum, row) => sum + row['Preço Total'], 0);
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    const productSales = {};
    data.forEach(row => {
        productSales[row['Medicamento']] = (productSales[row['Medicamento']] || 0) + row['Quantidade'];
    });

    const topProduct = Object.keys(productSales).length > 0
        ? Object.keys(productSales).reduce((a, b) => productSales[a] > productSales[b] ? a : b)
        : '-';

    document.getElementById('totalSales').textContent = formatNumber(totalSales);
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('avgTicket').textContent = formatCurrency(avgTicket);
    document.getElementById('topProduct').textContent = topProduct;
}

function aggregateDataByPeriod(data, period) {
    const aggregated = {};

    data.forEach(row => {
        const date = row['ParsedDate'];
        if (isNaN(date.getTime())) return; // Ignora datas inválidas

        let periodKey;
        let displayDate;

        if (period === 'daily') {
            periodKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
            displayDate = date.toLocaleDateString('pt-BR');
        } else if (period === 'weekly') {
            const startOfWeek = new Date(date);
            startOfWeek.setDate(date.getDate() - date.getDay()); // Domingo como início da semana
            periodKey = startOfWeek.toISOString().split('T')[0];
            displayDate = `Semana de ${startOfWeek.toLocaleDateString('pt-BR')}`;
        } else if (period === 'monthly') {
            periodKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`; // YYYY-MM
            displayDate = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        }

        if (!aggregated[periodKey]) {
            aggregated[periodKey] = {
                periodo: displayDate,
                revenue: 0,
                units: 0,
                count: 0,
                originalRows: [] // Para a tabela de detalhamento
            };
        }
        aggregated[periodKey].revenue += row['Preço Total'];
        aggregated[periodKey].units += row['Quantidade'];
        aggregated[periodKey].count++;
        aggregated[periodKey].originalRows.push(row); // Armazena as linhas originais
    });

    // Ordena os dados agregados por chave de período
    return Object.keys(aggregated)
        .sort()
        .map(key => aggregated[key]);
}

function updateCharts(groupedData, period) {
    const projectionMetric = document.getElementById('projectionMetric').value;
    const isRevenue = projectionMetric === 'revenue';

    const labels = groupedData.map(g => g.periodo);
    const historicalValues = groupedData.map(g => isRevenue ? g.revenue : g.units);

    // --- Lógica de Projeção (muito simplificada para demonstração) ---
    // Calcula a média dos últimos N períodos para projetar os próximos M períodos
    const numPeriodsForAverage = Math.min(groupedData.length, 5); // Média dos últimos 5 períodos
    const numProjectionPeriods = 3; // Projeta 3 períodos futuros

    let averageValue = 0;
    if (historicalValues.length > 0) {
        const recentValues = historicalValues.slice(-numPeriodsForAverage);
        averageValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    }

    const projectionLabels = [];
    const projectionValues = [];
    let lastPeriodDate = groupedData.length > 0 ? groupedData[groupedData.length - 1].originalRows[0]['ParsedDate'] : new Date();

    for (let i = 1; i <= numProjectionPeriods; i++) {
        let nextDate;
        let projectionLabel;

        if (period === 'daily') {
            nextDate = new Date(lastPeriodDate);
            nextDate.setDate(lastPeriodDate.getDate() + i);
            projectionLabel = `+${i} dia`;
        } else if (period === 'weekly') {
            nextDate = new Date(lastPeriodDate);
            nextDate.setDate(lastPeriodDate.getDate() + (i * 7));
            projectionLabel = `+${i} semana`;
        } else if (period === 'monthly') {
            nextDate = new Date(lastPeriodDate);
            nextDate.setMonth(lastPeriodDate.getMonth() + i);
            projectionLabel = `+${i} mês`;
        }
        projectionLabels.push(projectionLabel);
        projectionValues.push(averageValue);
    }

    // --- Atualiza Gráfico de Histórico ---
    const historicalCtx = document.getElementById('historicalChart').getContext('2d');
    if (historicalChart) historicalChart.destroy();
    historicalChart = new Chart(historicalCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: isRevenue ? 'Receita Histórica (R$)' : 'Unidades Históricas',
                data: historicalValues,
                backgroundColor: 'rgba(0, 72, 72, 0.8)',
                borderColor: 'rgba(0, 72, 72, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'category',
                    title: {
                        display: true,
                        text: 'Período'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: isRevenue ? 'Receita (R$)' : 'Unidades'
                    },
                    ticks: {
                        callback: function(value) {
                            return isRevenue ? formatCurrency(value) : formatNumber(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += isRevenue ? formatCurrency(context.parsed.y) : formatNumber(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });

    // --- Atualiza Gráfico de Projeção ---
    const projectionCtx = document.getElementById('projectionChart').getContext('2d');
    if (projectionChart) projectionChart.destroy();
    projectionChart = new Chart(projectionCtx, {
        type: 'line',
        data: {
            labels: projectionLabels,
            datasets: [{
                label: isRevenue ? 'Projeção (R$)' : 'Projeção (Unidades)',
                data: projectionValues,
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'category',
                    title: {
                        display: true,
                        text: 'Período Futuro'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: isRevenue ? 'Receita Projetada (R$)' : 'Unidades Projetadas'
                    },
                    ticks: {
                        callback: function(value) {
                            return isRevenue ? formatCurrency(value) : formatNumber(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += isRevenue ? formatCurrency(context.parsed.y) : formatNumber(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function updateTable(originalFilteredData, groupedData, period) {
    const tableBody = document.getElementById('salesTableBody');
    tableBody.innerHTML = ''; // Limpa a tabela

    const tableTitle = document.getElementById('tableTitle');
    let titleText = '📋 Detalhamento ';

    let dataToDisplay = [];

    if (period === 'daily') {
        titleText += 'Diário';
        // Para detalhamento diário, mostramos as linhas originais filtradas
        dataToDisplay = originalFilteredData.slice(0, 500); // Limita a 500 linhas
    } else {
        // Para semanal/mensal, mostramos os dados agregados
        titleText += period === 'weekly' ? 'Semanal' : 'Mensal';
        // Criamos linhas para a tabela a partir dos dados agrupados
        dataToDisplay = groupedData.map(g => ({
            'Data': g.periodo,
            'Medicamento': 'Total do Período',
            'Categoria': '-',
            'Quantidade': g.units,
            'Preço Unitário': g.revenue / g.units || 0, // Ticket médio do período
            'Preço Total': g.revenue,
            'Cidade': '-',
            'Vendedor': '-'
        })).slice(0, 500); // Limita a 500 linhas
    }

    tableTitle.textContent = `${titleText} (Máximo ${dataToDisplay.length} linhas)`;

    dataToDisplay.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row['Data']}</td>
            <td>${row['Medicamento']}</td>
            <td>${row['Categoria']}</td>
            <td>${formatNumber(row['Quantidade'])}</td>
            <td>${formatCurrency(row['Preço Unitário'])}</td>
            <td>${formatCurrency(row['Preço Total'])}</td>
            <td>${row['Cidade']}</td>
            <td>${row['Vendedor']}</td>
        `;
        tableBody.appendChild(tr);
    });
}

// Função para atualizar os filtros dependentes (Categoria, Medicamento, Vendedor)
function updateDependentFilters() {
    const selectedCidade = document.getElementById('filterCidade').value;
    const selectedCategoria = document.getElementById('filterCategoria').value;
    const selectedMedicamento = document.getElementById('filterMedicamento').value;
    const selectedVendedor = document.getElementById('filterVendedor').value;

    let filteredForNextDropdowns = allData;

    // Filtra pelos valores selecionados nos filtros anteriores
    if (selectedCidade !== 'all') {
        filteredForNextDropdowns = filteredForNextDropdowns.filter(row => row['Cidade'] === selectedCidade);
    }
    populateSelect('filterCategoria', getUniqueValues(filteredForNextDropdowns, 'Categoria'), 'Todas as Categorias');
    // Tenta restaurar a seleção da categoria
    if (selectedCategoria !== 'all' && getUniqueValues(filteredForNextDropdowns, 'Categoria').includes(selectedCategoria)) {
        document.getElementById('filterCategoria').value = selectedCategoria;
    } else {
        document.getElementById('filterCategoria').value = 'all';
    }

    if (selectedCategoria !== 'all') {
        filteredForNextDropdowns = filteredForNextDropdowns.filter(row => row['Categoria'] === selectedCategoria);
    }
    populateSelect('filterMedicamento', getUniqueValues(filteredForNextDropdowns, 'Medicamento'), 'Todos os Medicamentos');
    // Tenta restaurar a seleção do medicamento
    if (selectedMedicamento !== 'all' && getUniqueValues(filteredForNextDropdowns, 'Medicamento').includes(selectedMedicamento)) {
        document.getElementById('filterMedicamento').value = selectedMedicamento;
    } else {
        document.getElementById('filterMedicamento').value = 'all';
    }

    if (selectedMedicamento !== 'all') {
        filteredForNextDropdowns = filteredForNextDropdowns.filter(row => row['Medicamento'] === selectedMedicamento);
    }
    populateSelect('filterVendedor', getUniqueValues(filteredForNextDropdowns, 'Vendedor'), 'Todos os Vendedores');
    // Tenta restaurar a seleção do vendedor
    if (selectedVendedor !== 'all' && getUniqueValues(filteredForNextDropdowns, 'Vendedor').includes(selectedVendedor)) {
        document.getElementById('filterVendedor').value = selectedVendedor;
    } else {
        document.getElementById('filterVendedor').value = 'all';
    }
}


// Carrega o CSV quando o DOM estiver completamente carregado
document.addEventListener('DOMContentLoaded', () => {
    loadCSV();

    // Adiciona event listeners para os filtros
    document.getElementById('filterCidade').addEventListener('change', () => {
        applyFilters();
        updateDependentFilters(); // Garante que os filtros dependentes sejam atualizados
    });
    document.getElementById('filterCategoria').addEventListener('change', () => {
        applyFilters();
        updateDependentFilters();
    });
    document.getElementById('filterMedicamento').addEventListener('change', () => {
        applyFilters();
        updateDependentFilters();
    });
    document.getElementById('filterVendedor').addEventListener('change', () => {
        applyFilters();
        updateDependentFilters();
    });
    document.getElementById('filterPeriodo').addEventListener('change', applyFilters);
    document.getElementById('projectionMetric').addEventListener('change', applyFilters); // Event listener para a métrica da projeção
    document.getElementById('clearBtn').addEventListener('click', clearFilters);
});
