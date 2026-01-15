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

// Função auxiliar para parsear data. Agora, espera YYYY-MM-DD diretamente.
function parseDateString(dateString) {
    // Tenta criar a data diretamente. Se o formato for YYYY-MM-DD, o construtor Date geralmente funciona bem.
    const date = new Date(dateString);

    // Verifica se a data é válida.
    if (isNaN(date.getTime())) {
        // Se a data ainda for inválida, tenta o formato DD/MM/YYYY como fallback
        const parts = dateString.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Mês é 0-indexado
            const year = parseInt(parts[2], 10);
            const fallbackDate = new Date(year, month, day);
            if (!isNaN(fallbackDate.getTime())) {
                return fallbackDate;
            }
        }
        return new Date('Invalid Date'); // Retorna data inválida se nenhum formato funcionar
    }
    return date;
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

        // Tenta detectar o separador: ; ou , ou \t
        let separator = ','; // Padrão
        if (lines[0].includes(';')) {
            separator = ';';
        } else if (lines[0].includes('\t')) {
            separator = '\t';
        }
        console.log(`Separador detectado: '${separator}'`);

        const headers = lines[0].split(separator).map(h => h.trim().replace(/"/g, ''));
        console.log('Headers do CSV:', headers);

        allData = [];
        let invalidDateCount = 0;
        let invalidPriceCount = 0;
        let invalidQuantityCount = 0;
        let columnMismatchCount = 0;

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const values = lines[i].split(separator).map(v => v.trim().replace(/"/g, ''));
            if (values.length !== headers.length) {
                console.warn(`Linha ${i + 1} ignorada (colunas): Esperado ${headers.length}, encontrado ${values.length}. Linha: "${lines[i]}"`);
                columnMismatchCount++;
                continue; // Pula linhas com número incorreto de colunas
            }

            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });

            // Usa a função robusta para parsear a data
            row['ParsedDate'] = parseDateString(row['Data']);

            // Verifica se a data é válida
            if (isNaN(row['ParsedDate'].getTime())) {
                console.warn(`Linha ${i + 1} ignorada (data): Data inválida encontrada: "${row['Data']}".`);
                invalidDateCount++;
                continue; // Pula esta linha se a data for inválida
            }

            // Tratamento de preço mais robusto: remove pontos de milhar e substitui vírgula por ponto decimal
            let rawPrice = row['Preço'].replace('R$', '').trim();
            rawPrice = rawPrice.replace(/\./g, '').replace(',', '.'); // Remove todos os pontos e substitui vírgula por ponto
            let precoUnitario = parseFloat(rawPrice);
            if (isNaN(precoUnitario)) {
                console.warn(`Linha ${i + 1} (preço): Preço unitário inválido: "${row['Preço']}". Usando 0.`);
                invalidPriceCount++;
                precoUnitario = 0; // Define como 0 se for inválido, mas não pula a linha
            }
            row['Preço Unitário'] = precoUnitario;

            let quantidade = parseInt(row['Quantidade']) || 1;
            if (isNaN(quantidade)) {
                console.warn(`Linha ${i + 1} (quantidade): Quantidade inválida: "${row['Quantidade']}". Usando 1.`);
                invalidQuantityCount++;
                quantidade = 1; // Define como 1 se for inválido
            }
            row['Quantidade'] = quantidade;

            row['Preço Total'] = precoUnitario * quantidade;

            allData.push(row);
        }

        console.log(`CSV carregado com sucesso: ${allData.length} registros válidos.`);
        if (invalidDateCount > 0) console.warn(`${invalidDateCount} linhas ignoradas devido a datas inválidas.`);
        if (invalidPriceCount > 0) console.warn(`${invalidPriceCount} preços unitários definidos como 0 devido a formato inválido.`);
        if (invalidQuantityCount > 0) console.warn(`${invalidQuantityCount} quantidades definidas como 1 devido a formato inválido.`);
        if (columnMismatchCount > 0) console.warn(`${columnMismatchCount} linhas ignoradas devido a número incorreto de colunas.`);

        if (allData.length === 0) {
            alert('Nenhum dado válido foi encontrado no CSV após o processamento. Verifique o formato do arquivo e o console para detalhes.');
        }
        initializeFilters(); // Inicializa os filtros com todos os dados
        updateDashboard(allData); // Atualiza o dashboard com todos os dados
        updateDependentFilters(); // Garante que os filtros dependentes sejam populados corretamente
    } catch (error) {
        console.error('Erro fatal ao parsear CSV:', error);
        alert('Erro fatal ao processar dados do CSV. Verifique o console para mais detalhes.');
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
    // Não desabilita aqui, updateDependentFilters fará isso se não houver opções
    // document.getElementById('filterCategoria').disabled = true;
    // document.getElementById('filterMedicamento').disabled = true;
    // document.getElementById('filterVendedor').disabled = true;
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
    updateLastUpdateDate(); // Atualiza a data da última atualização
}

function updateStats(data) {
    const totalSales = data.length;
    const totalRevenue = data.reduce((sum, row) => sum + row['Preço Total'], 0);
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    const productCounts = {}; // Para contar vendas por produto (para "Produto Top")
    data.forEach(row => {
        productCounts[row['Medicamento']] = (productCounts[row['Medicamento']] || 0) + row['Quantidade']; // Soma quantidades para top produto
    });

    const topProduct = Object.keys(productCounts).length > 0
        ? Object.keys(productCounts).reduce((a, b) => productCounts[a] > productCounts[b] ? a : b)
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
            periodKey = date.toISOString().split('T')[0]; // YYYY-MM-DD para ordenação
            displayDate = date.toLocaleDateString('pt-BR');
        } else if (period === 'weekly') {
            const startOfWeek = new Date(date);
            startOfWeek.setDate(date.getDate() - date.getDay()); // Domingo como início da semana
            periodKey = startOfWeek.toISOString().split('T')[0]; // YYYY-MM-DD para ordenação
            displayDate = `Semana de ${startOfWeek.toLocaleDateString('pt-BR')}`;
        } else if (period === 'monthly') {
            periodKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`; // YYYY-MM para ordenação
            displayDate = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        }

        if (!aggregated[periodKey]) {
            aggregated[periodKey] = {
                periodo: displayDate,
                revenue: 0,
                units: 0,
                count: 0, // Contagem de transações no período
                medicamentos: new Set(), // Adicionado para a tabela
                categorias: new Set(),   // Adicionado para a tabela
                cidades: new Set(),      // Adicionado para a tabela
                vendedores: new Set(),   // Adicionado para a tabela
                originalRows: [] // Para a tabela de detalhamento
            };
        }
        aggregated[periodKey].revenue += row['Preço Total'];
        aggregated[periodKey].units += row['Quantidade'];
        aggregated[periodKey].count++;
        aggregated[periodKey].medicamentos.add(row['Medicamento']); // Popula o set
        aggregated[periodKey].categorias.add(row['Categoria']);     // Popula o set
        aggregated[periodKey].cidades.add(row['Cidade']);           // Popula o set
        aggregated[periodKey].vendedores.add(row['Vendedor']);     // Popula o set
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

    console.log("Dados para Histórico de Vendas:", { labels, historicalValues, isRevenue });

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
    // Pega a data do último ponto de dado para basear a projeção
    // Adicionado fallback para new Date() se groupedData estiver vazio
    let lastPeriodDate = groupedData.length > 0 && groupedData[groupedData.length - 1].originalRows.length > 0 
                         ? groupedData[groupedData.length - 1].originalRows[0]['ParsedDate'] 
                         : new Date();

    for (let i = 1; i <= numProjectionPeriods; i++) {
        let nextDate;
        let projectionLabel;

        // Cria uma nova data para cada projeção para evitar mutação
        const baseDate = new Date(lastPeriodDate); 

        if (period === 'daily') {
            nextDate = new Date(baseDate);
            nextDate.setDate(baseDate.getDate() + i);
            projectionLabel = `+${i} dia`;
        } else if (period === 'weekly') {
            nextDate = new Date(baseDate);
            nextDate.setDate(baseDate.getDate() + (i * 7));
            projectionLabel = `+${i} semana`;
        } else if (period === 'monthly') {
            nextDate = new Date(baseDate);
            nextDate.setMonth(baseDate.getMonth() + i);
            projectionLabel = `+${i} mês`;
        }
        projectionLabels.push(projectionLabel);
        // Adiciona uma pequena variação aleatória à média para a projeção
        let projectedValue = averageValue * (1 + (Math.random() - 0.5) * 0.1); // +/- 5% de variação
        projectionValues.push(Math.max(0, Math.round(projectedValue))); // Garante que não seja negativo e arredonda para unidades
    }
    console.log("Dados para Projeção de Vendas:", { projectionLabels, projectionValues, isRevenue });


    // --- Atualiza Gráfico de Histórico ---
    const historicalCtx = document.getElementById('historicalChart').getContext('2d');
    if (historicalChart) historicalChart.destroy();
    historicalChart = new Chart(historicalCtx, {
        type: 'bar', // Alterado para barra para melhor visualização de períodos discretos
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
        type: 'line', // Mantido como linha para projeção
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
            'Medicamento': Array.from(g.medicamentos).join(', '), // Mostra todos os medicamentos vendidos no período
            'Categoria': Array.from(g.categorias).join(', '), // Mostra todas as categorias vendidas no período
            'Quantidade': g.units,
            'Preço Unitário': g.revenue / g.units || 0, // Ticket médio do período
            'Preço Total': g.revenue,
            'Cidade': Array.from(g.cidades).join(', '), // Mostra todas as cidades no período
            'Vendedor': Array.from(g.vendedores).join(', ') // Mostra todos os vendedores no período
        })).slice(0, 500); // Limita a 500 linhas
    }

    tableTitle.textContent = `${titleText} (Máximo ${dataToDisplay.length} linhas)`;

    // Atualiza o cabeçalho da tabela dinamicamente
    const tableHeadRow = document.getElementById('salesTable').querySelector('thead tr');
    tableHeadRow.innerHTML = ''; // Limpa o cabeçalho existente

    if (period === 'daily') {
        tableHeadRow.innerHTML = `
            <th>Data</th>
            <th>Medicamento</th>
            <th>Categoria</th>
            <th>Quantidade</th>
            <th>Preço Unitário</th>
            <th>Preço Total</th>
            <th>Cidade</th>
            <th>Vendedor</th>
        `;
        dataToDisplay.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row['Data']}</td>
                <td>${row['Medicamento']}</td>
                <td>${row['Categoria']}</td>
                <td>${formatNumber(row['Quantidade'])}</td>
                <td>${formatCurrency(row['Preço Unitário'])}</td>
                <td>${row['Preço Total']}</td>
                <td>${row['Cidade']}</td>
                <td>${row['Vendedor']}</td>
            `;
            tableBody.appendChild(tr);
        });
    } else {
        tableHeadRow.innerHTML = `
            <th>Período</th>
            <th>Medicamentos Vendidos</th>
            <th>Categorias Vendidas</th>
            <th>Quantidade Total</th>
            <th>Ticket Médio Período</th>
            <th>Receita Total</th>
            <th>Cidades</th>
            <th>Vendedores</th>
        `;
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
