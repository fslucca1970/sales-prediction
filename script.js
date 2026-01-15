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
    const currentSelection = select.value;
    select.innerHTML = `<option value="all">${defaultText}</option>`;
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        select.appendChild(opt);
    });
    // Tenta restaurar a seleção anterior, se ainda for uma opção válida
    if (options.includes(currentSelection) || currentSelection === 'all') {
        select.value = currentSelection;
    } else {
        select.value = 'all'; // Volta para 'all' se a opção anterior não existe mais
    }
    select.disabled = false;
}

function initializeFilters() {
    // Popula os filtros com base em ALLDATA, não em dados filtrados
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

// Função para agrupar dados por período (diário, semanal, mensal)
function aggregateDataByPeriod(data, period) {
    const grouped = {};

    data.forEach(row => {
        const date = row['ParsedDate']; // Usa a data já parseada
        if (isNaN(date.getTime())) return; // Pula se a data for inválida

        let key;
        let sortKey; // Chave para ordenação

        if (period === 'daily') {
            key = row['Data']; // Mantém a data original para exibição
            sortKey = date.toISOString(); // Usa ISO para ordenação
        } else if (period === 'weekly') {
            const startOfWeek = new Date(date);
            startOfWeek.setDate(date.getDate() - date.getDay());
            key = `Semana de ${startOfWeek.toLocaleDateString('pt-BR')}`;
            sortKey = startOfWeek.toISOString();
        } else if (period === 'monthly') {
            key = `${date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
            sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        if (!grouped[sortKey]) { // Agrupa pela chave de ordenação
            grouped[sortKey] = {
                periodo: key, // Exibe a chave formatada
                receita: 0,
                quantidade: 0,
                medicamentos: new Set(),
                categorias: new Set(),
                cidades: new Set(),
                vendedores: new Set(),
                vendas: []
            };
        }

        grouped[sortKey].receita += row['Preço Total'];
        grouped[sortKey].quantidade += row['Quantidade'];
        grouped[sortKey].medicamentos.add(row['Medicamento']);
        grouped[sortKey].categorias.add(row['Categoria']);
        grouped[sortKey].cidades.add(row['Cidade']);
        grouped[sortKey].vendedores.add(row['Vendedor']);
        grouped[sortKey].vendas.push(row);
    });

    const result = Object.values(grouped).map(g => ({
        ...g,
        MedicamentosVendidos: Array.from(g.medicamentos).join(', '),
        CategoriasVendidas: Array.from(g.categorias).join(', '),
        Cidades: Array.from(g.cidades).join(', '),
        Vendedores: Array.from(g.vendedores).join(', '),
        TotalDeVendas: g.vendas.length
    }));

    // Ordena o resultado final usando a chave de ordenação implícita do Object.values
    result.sort((a, b) => {
        // Para garantir a ordenação correta, especialmente para "Semana de" e "Mês de"
        // precisamos de uma lógica de ordenação mais robusta aqui, baseada nas datas reais.
        // Como as chaves de agrupamento (sortKey) já são ordenáveis (ISO string ou YYYY-MM),
        // podemos usá-las para ordenar o array final.
        const keyA = Object.keys(grouped).find(k => grouped[k].periodo === a.periodo);
        const keyB = Object.keys(grouped).find(k => grouped[k].periodo === b.periodo);
        return keyA.localeCompare(keyB);
    });

    return result;
}


function updateDashboard(data) {
    updateStats(data);
    updateCharts(data);
    updateTable(data);
    updateLastUpdateDate();
}

function updateStats(data) {
    const totalSales = data.length;
    const totalRevenue = data.reduce((sum, row) => sum + row['Preço Total'], 0);
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    const productSales = {};
    data.forEach(row => {
        const product = row['Medicamento'];
        productSales[product] = (productSales[product] || 0) + row['Preço Total'];
    });

    const topProduct = Object.keys(productSales).length > 0
        ? Object.keys(productSales).reduce((a, b) => productSales[a] > productSales[b] ? a : b)
        : '-';

    document.getElementById('totalSales').textContent = formatNumber(totalSales);
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('avgTicket').textContent = formatCurrency(avgTicket);
    document.getElementById('topProduct').textContent = topProduct;
}

function updateCharts(data) {
    const period = document.getElementById('filterPeriodo').value;
    const groupedData = aggregateDataByPeriod(data, period);

    const labels = groupedData.map(g => g.periodo);
    const revenues = groupedData.map(g => g.receita);
    const quantities = groupedData.map(g => g.quantidade);

    // --- Gráfico de Histórico de Vendas ---
    const ctxHistorical = document.getElementById('historicalChart').getContext('2d');
    if (historicalChart) {
        historicalChart.destroy();
    }
    historicalChart = new Chart(ctxHistorical, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Receita Histórica',
                data: revenues,
                borderColor: 'rgb(0, 72, 72)',
                backgroundColor: 'rgba(0, 72, 72, 0.2)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'category', // Usa 'category' para rótulos de período
                    title: {
                        display: true,
                        text: 'Período'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Receita (R$)'
                    },
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
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatCurrency(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });

    // --- Gráfico de Projeção de Vendas ---
    const ctxProjection = document.getElementById('projectionChart').getContext('2d');
    if (projectionChart) {
        projectionChart.destroy();
    }

    const projectionMetric = document.getElementById('projectionMetric').value;

    let projectionLabels = [];
    let projectionData = [];
    let projectionTitle = '';
    let projectionUnitFormatter = null;

    if (groupedData.length > 0) {
        const lastDataPoint = groupedData[groupedData.length - 1];
        let baseValue;

        if (projectionMetric === 'revenue') {
            baseValue = lastDataPoint.receita;
            projectionTitle = 'Projeção de Receita';
            projectionUnitFormatter = formatCurrency;
        } else { // 'units'
            baseValue = lastDataPoint.quantidade;
            projectionTitle = 'Projeção de Unidades';
            projectionUnitFormatter = formatNumber;
        }

        // Simples projeção baseada na média dos últimos 3 pontos, com alguma variação
        const lastThreeValues = groupedData.slice(-3).map(g => projectionMetric === 'revenue' ? g.receita : g.quantidade);
        const averageLastThree = lastThreeValues.length > 0 ? lastThreeValues.reduce((a, b) => a + b, 0) / lastThreeValues.length : baseValue;

        for (let i = 1; i <= 3; i++) { // Projeta para os próximos 3 períodos
            let projectedValue = averageLastThree * (1 + (Math.random() - 0.5) * 0.1); // +/- 5% de variação
            projectionData.push(Math.max(0, Math.round(projectedValue))); // Garante que não seja negativo e arredonda para unidades

            if (period === 'daily') {
                projectionLabels.push(`+${i} dia`);
            } else if (period === 'weekly') {
                projectionLabels.push(`+${i} semana`);
            } else if (period === 'monthly') {
                projectionLabels.push(`+${i} mês`);
            }
        }
    }

    projectionChart = new Chart(ctxProjection, {
        type: 'bar',
        data: {
            labels: projectionLabels,
            datasets: [{
                label: projectionTitle,
                data: projectionData,
                backgroundColor: 'rgba(0, 72, 72, 0.7)',
                borderColor: 'rgb(0, 72, 72)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Período Futuro'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: projectionMetric === 'revenue' ? 'Receita (R$)' : 'Unidades'
                    },
                    ticks: {
                        callback: function(value) {
                            return projectionUnitFormatter(value);
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
                                label += projectionUnitFormatter(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function updateTable(data) {
    const tbody = document.getElementById('salesTableBody');
    const tableTitle = document.getElementById('tableTitle');
    const period = document.getElementById('filterPeriodo').value;
    tbody.innerHTML = ''; // Limpa a tabela

    let aggregatedTableData = [];
    let currentTableTitle = '';

    if (period === 'daily') {
        // Para o modo diário, exibe os dados brutos (até 500 linhas)
        aggregatedTableData = data.slice(0, 500);
        currentTableTitle = '📋 Detalhamento Diário (Máximo 500 linhas)';
    } else {
        // Para semanal/mensal, agrega os dados para a tabela
        aggregatedTableData = aggregateDataByPeriod(data, period);
        currentTableTitle = `📋 Detalhamento ${period === 'weekly' ? 'Semanal' : 'Mensal'}`;
    }

    tableTitle.textContent = currentTableTitle;

    if (period === 'daily') {
        // Cabeçalho para detalhamento diário
        document.getElementById('salesTable').querySelector('thead tr').innerHTML = `
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
                <td>${formatNumber(row['Quantidade'])}</td>
                <td>${formatCurrency(row['Preço Unitário'])}</td>
                <td>${formatCurrency(row['Preço Total'])}</td>
                <td>${row['Cidade']}</td>
                <td>${row['Vendedor']}</td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        // Cabeçalho para detalhamento agregado (semanal/mensal)
        document.getElementById('salesTable').querySelector('thead tr').innerHTML = `
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
                <td>${row['periodo']}</td>
                <td>${formatNumber(row['TotalDeVendas'])}</td>
                <td>${formatCurrency(row['receita'])}</td>
                <td>${row['MedicamentosVendidos']}</td>
                <td>${row['CategoriasVendidas']}</td>
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
        applyFilters();
    });

    document.getElementById('projectionMetric').addEventListener('change', function() {
        applyFilters();
    });

    document.getElementById('clearBtn').addEventListener('click', function() {
        document.getElementById('filterCidade').value = 'all';
        document.getElementById('filterCategoria').value = 'all';
        document.getElementById('filterMedicamento').value = 'all';
        document.getElementById('filterVendedor').value = 'all';
        document.getElementById('filterPeriodo').value = 'daily';
        document.getElementById('projectionMetric').value = 'revenue';

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
