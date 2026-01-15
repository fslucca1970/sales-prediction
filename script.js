// As importações do Chart.js e do adaptador de data-fns são feitas no index.html

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

// Função auxiliar para parsear data. Espera YYYY-MM-DD ou DD/MM/YYYY.
function parseDateString(dateString) {
    // Tenta o formato YYYY-MM-DD primeiro (ISO 8601)
    let date = new Date(dateString);
    // Se for inválida, tenta o formato DD/MM/YYYY
    if (isNaN(date.getTime())) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Mês é 0-indexado
            const year = parseInt(parts[2], 10);
            date = new Date(year, month, day);
            // Validação extra para datas como 31/02
            if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
                return new Date('Invalid Date');
            }
        } else {
            return new Date('Invalid Date'); // Nem YYYY-MM-DD nem DD/MM/YYYY
        }
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
        alert('Erro ao carregar dados. Verifique o console para mais detalhes.');
    }
}

function parseCSV(csv) {
    try {
        const lines = csv.trim().split('\n');
        if (lines.length < 2) {
            alert('CSV vazio ou inválido.');
            return;
        }

        let separator = ',';
        if (lines[0].includes(';')) {
            separator = ';';
        } else if (lines[0].includes('\t')) {
            separator = '\t';
        }

        const headers = lines[0].split(separator).map(h => h.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const currentLine = lines[i].trim();
            if (!currentLine) continue; // Pula linhas vazias

            const values = currentLine.split(separator);
            const row = {};
            let isValidRow = true;

            for (let j = 0; j < headers.length; j++) {
                row[headers[j]] = values[j] ? values[j].trim() : '';
            }

            // Validar e parsear dados
            const date = parseDateString(row['Data']);
            if (isNaN(date.getTime())) {
                console.warn(`Linha ${i + 1}: Data inválida "${row['Data']}". Linha ignorada.`);
                isValidRow = false;
            }
            row['Data'] = date; // Armazena o objeto Date parseado

            // Usar 'Preço' do CSV para Preço Unitário
            let precoUnitarioRaw = String(row['Preço'] || '0').replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
            const precoUnitario = parseFloat(precoUnitarioRaw);
            if (isNaN(precoUnitario)) {
                console.warn(`Linha ${i + 1}: Preço Unitário inválido "${row['Preço']}". Usando 0.`);
                isValidRow = false;
            }
            row['Preço Unitário'] = precoUnitario; // Armazenar como 'Preço Unitário' para consistência interna

            let quantidadeRaw = String(row['Quantidade'] || '0').replace('.', '').replace(',', '.').trim();
            const quantidade = parseInt(quantidadeRaw, 10);
            if (isNaN(quantidade)) {
                console.warn(`Linha ${i + 1}: Quantidade inválida "${row['Quantidade']}". Usando 1.`);
                isValidRow = false;
            }
            row['Quantidade'] = quantidade;

            // Calcular Preço Total, já que não há coluna 'Preço Total' no CSV
            row['Preço Total'] = precoUnitario * quantidade;

            if (isValidRow) {
                data.push(row);
            }
        }

        allData = data;
        console.log(`CSV carregado com sucesso: ${allData.length} registros válidos.`);
        updateLastUpdateDate(); // Atualiza a data da última atualização

        initializeFilters();
        applyFilters(); // Aplica os filtros iniciais e renderiza tudo
    } catch (error) {
        console.error('Erro ao processar dados do CSV:', error);
        alert('Erro ao processar dados do CSV. Verifique o console para mais detalhes.');
    }
}

function getUniqueValues(data, key) {
    const values = [...new Set(data.map(item => item[key]))].filter(Boolean); // Remove valores vazios/nulos
    return values.sort();
}

function populateSelect(elementId, items, defaultOptionText) {
    const select = document.getElementById(elementId);
    if (!select) {
        console.error(`Elemento com ID '${elementId}' não encontrado.`);
        return;
    }
    const currentSelection = select.value;
    select.innerHTML = `<option value="all">${defaultOptionText}</option>`; // Limpa e adiciona opção padrão

    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        select.appendChild(option);
    });
    // Tenta restaurar a seleção anterior, se ainda for uma opção válida
    if (items.includes(currentSelection) || currentSelection === 'all') {
        select.value = currentSelection;
    } else {
        select.value = 'all';
    }
    select.disabled = false; // Garante que o filtro esteja habilitado
}

function initializeFilters() {
    populateSelect('filterCidade', getUniqueValues(allData, 'Cidade'), 'Todas as Cidades');
    populateSelect('filterCategoria', getUniqueValues(allData, 'Categoria'), 'Todas as Categorias');
    populateSelect('filterMedicamento', getUniqueValues(allData, 'Medicamento'), 'Todos os Medicamentos');
    populateSelect('filterVendedor', getUniqueValues(allData, 'Vendedor'), 'Todos os Vendedores');

    // Adiciona event listeners para os filtros
    document.getElementById('filterCidade').addEventListener('change', () => {
        applyFilters();
        updateDependentFilters(); // Atualiza os filtros dependentes
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
    document.getElementById('projectionMetric').addEventListener('change', applyFilters);
    document.getElementById('clearBtn').addEventListener('click', clearFilters);
}

function updateDependentFilters() {
    const selectedCidade = document.getElementById('filterCidade').value;
    const selectedCategoria = document.getElementById('filterCategoria').value;
    const selectedMedicamento = document.getElementById('filterMedicamento').value;
    const selectedVendedor = document.getElementById('filterVendedor').value;

    let filtered = allData;

    if (selectedCidade !== 'all') {
        filtered = filtered.filter(item => item['Cidade'] === selectedCidade);
    }

    // Popula os filtros dependentes com base nos dados filtrados
    const categorias = [...new Set(filtered.map(item => item['Categoria']))].filter(Boolean).sort();
    const medicamentos = [...new Set(filtered.map(item => item['Medicamento']))].filter(Boolean).sort();
    const vendedores = [...new Set(filtered.map(item => item['Vendedor']))].filter(Boolean).sort();

    populateSelect('filterCategoria', categorias, 'Todas as Categorias');
    populateSelect('filterMedicamento', medicamentos, 'Todos os Medicamentos');
    populateSelect('filterVendedor', vendedores, 'Todos os Vendedores');

    // Restaura a seleção se o valor ainda existir
    if (categorias.includes(selectedCategoria)) {
        document.getElementById('filterCategoria').value = selectedCategoria;
    } else {
        document.getElementById('filterCategoria').value = 'all';
    }
    if (medicamentos.includes(selectedMedicamento)) {
        document.getElementById('filterMedicamento').value = selectedMedicamento;
    } else {
        document.getElementById('filterMedicamento').value = 'all';
    }
    if (vendedores.includes(selectedVendedor)) {
        document.getElementById('filterVendedor').value = selectedVendedor;
    } else {
        document.getElementById('filterVendedor').value = 'all';
    }
}


function applyFilters() {
    let filteredData = allData;

    const selectedCidade = document.getElementById('filterCidade').value;
    const selectedCategoria = document.getElementById('filterCategoria').value;
    const selectedMedicamento = document.getElementById('filterMedicamento').value;
    const selectedVendedor = document.getElementById('filterVendedor').value;
    const selectedPeriodo = document.getElementById('filterPeriodo').value; // Obtém o período selecionado

    if (selectedCidade !== 'all') {
        filteredData = filteredData.filter(item => item['Cidade'] === selectedCidade);
    }
    if (selectedCategoria !== 'all') {
        filteredData = filteredData.filter(item => item['Categoria'] === selectedCategoria);
    }
    if (selectedMedicamento !== 'all') {
        filteredData = filteredData.filter(item => item['Medicamento'] === selectedMedicamento);
    }
    if (selectedVendedor !== 'all') {
        filteredData = filteredData.filter(item => item['Vendedor'] === selectedVendedor);
    }

    updateStats(filteredData);
    renderCharts(filteredData, selectedPeriodo); // Passa o período para renderCharts
    updateTable(filteredData);
}

function clearFilters() {
    document.getElementById('filterCidade').value = 'all';
    document.getElementById('filterCategoria').value = 'all';
    document.getElementById('filterMedicamento').value = 'all';
    document.getElementById('filterVendedor').value = 'all';
    document.getElementById('filterPeriodo').value = 'daily'; // Reseta o período para diário
    document.getElementById('projectionMetric').value = 'revenue'; // Reseta a métrica de projeção
    updateDependentFilters(); // Reseta os filtros dependentes
    applyFilters();
}

function updateStats(data) {
    const totalVendas = data.length;
    const receitaTotal = data.reduce((sum, item) => sum + item['Preço Total'], 0);
    const totalUnidades = data.reduce((sum, item) => sum + item.Quantidade, 0);
    const ticketMedio = totalVendas > 0 ? receitaTotal / totalVendas : 0;

    const productCounts = {};
    data.forEach(item => {
        productCounts[item.Medicamento] = (productCounts[item.Medicamento] || 0) + item.Quantidade;
    });

    const topProduct = Object.keys(productCounts).length > 0
        ? Object.keys(productCounts).sort((a, b) => productCounts[b] - productCounts[a])[0]
        : 'N/A';

    document.getElementById('totalSales').textContent = formatNumber(totalVendas);
    document.getElementById('totalRevenue').textContent = formatCurrency(receitaTotal);
    document.getElementById('avgTicket').textContent = formatCurrency(ticketMedio);
    document.getElementById('totalUnits').textContent = formatNumber(totalUnidades);
    document.getElementById('topProduct').textContent = topProduct;
}

// ATENÇÃO: MODIFICAÇÃO CRÍTICA AQUI para retornar dados no formato { x: 'YYYY-MM-DD', y: valor }
function aggregateData(data, period) {
    const aggregated = {};

    data.forEach(item => {
        let key;
        const date = item['Data']; // Objeto Date

        if (period === 'daily') {
            key = date.toISOString().split('T')[0]; // YYYY-MM-DD
        } else if (period === 'weekly') {
            const d = new Date(date);
            d.setDate(d.getDate() - d.getDay()); // Volta para o domingo
            key = d.toISOString().split('T')[0];
        } else if (period === 'monthly') {
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`; // YYYY-MM-01 para consistência
        }

        if (!aggregated[key]) {
            aggregated[key] = {
                revenue: 0,
                units: 0,
                date: key // Armazena a chave para ordenação
            };
        }
        aggregated[key].revenue += item['Preço Total'];
        aggregated[key].units += item['Quantidade'];
    });

    // Converte para array e ordena por data
    const sortedAggregated = Object.values(aggregated).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Retorna no formato { x: 'YYYY-MM-DD', y: valor }
    return sortedAggregated.map(item => ({
        x: item.date,
        revenue: item.revenue,
        units: item.units
    }));
}

function renderCharts(data, period) {
    const aggregatedDataPoints = aggregateData(data, period); // Agora retorna { x, revenue, units }

    // Se não houver dados agregados, limpa os gráficos e exibe mensagem
    if (aggregatedDataPoints.length === 0) {
        console.warn("Não há dados agregados para renderizar os gráficos.");
        if (historicalChart) historicalChart.destroy();
        if (projectionChart) projectionChart.destroy();

        const historicalCanvas = document.getElementById('historicalChart');
        if (historicalCanvas) {
            const ctxHistorical = historicalCanvas.getContext('2d');
            ctxHistorical.clearRect(0, 0, historicalCanvas.width, historicalCanvas.height);
            ctxHistorical.font = "16px Arial";
            ctxHistorical.textAlign = "center";
            ctxHistorical.fillStyle = "#666";
            ctxHistorical.fillText("Sem dados para exibir o histórico.", historicalCanvas.width / 2, historicalCanvas.height / 2);
        }

        const projectionCanvas = document.getElementById('projectionChart');
        if (projectionCanvas) {
            const ctxProjection = projectionCanvas.getContext('2d');
            ctxProjection.clearRect(0, 0, projectionCanvas.width, projectionCanvas.height);
            ctxProjection.font = "16px Arial";
            ctxProjection.textAlign = "center";
            ctxProjection.fillStyle = "#666";
            ctxProjection.fillText("Sem dados para exibir a projeção.", projectionCanvas.width / 2, projectionCanvas.height / 2);
        }
        return;
    }

    // Extrai os dados para os datasets
    const historicalRevenueDataPoints = aggregatedDataPoints.map(item => ({ x: item.x, y: item.revenue }));
    const historicalUnitsDataPoints = aggregatedDataPoints.map(item => ({ x: item.x, y: item.units }));
    const labelsForChart = aggregatedDataPoints.map(item => item.x); // Usado para labels do eixo X

    const projectionMetric = document.getElementById('projectionMetric').value;
    const historicalMetricData = projectionMetric === 'revenue' ? historicalRevenueDataPoints : historicalUnitsDataPoints;
    const historicalMetricLabel = projectionMetric === 'revenue' ? 'Receita (R$)' : 'Unidades';
    const historicalMetricFormat = projectionMetric === 'revenue' ? formatCurrency : formatNumber;

    // Destruir gráficos existentes se houver
    if (historicalChart) historicalChart.destroy();
    if (projectionChart) projectionChart.destroy();

    // --- Gráfico Histórico de Vendas ---
    const historicalCanvas = document.getElementById('historicalChart');
    if (historicalCanvas) { // Verifica se o canvas existe
        const ctxHistorical = historicalCanvas.getContext('2d');
        historicalChart = new Chart(ctxHistorical, {
            type: 'bar',
            data: {
                labels: labelsForChart, // Passa as strings de data para o eixo X
                datasets: [{
                    label: historicalMetricLabel,
                    data: historicalMetricData, // Passa os objetos {x,y}
                    backgroundColor: 'rgba(0, 72, 72, 0.6)',
                    borderColor: 'rgb(0, 72, 72)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            parser: 'yyyy-MM-dd', // Explicitamente define o parser para o formato ISO
                            unit: period === 'daily' ? 'day' : (period === 'weekly' ? 'week' : 'month'),
                            tooltipFormat: period === 'daily' ? 'dd/MM/yyyy' : (period === 'weekly' ? 'dd/MM/yyyy' : 'MM/yyyy'),
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
                        title: {
                            display: true,
                            text: historicalMetricLabel
                        },
                        ticks: {
                            callback: function(value) {
                                return historicalMetricFormat(value);
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
                                    label += historicalMetricFormat(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    } else {
        console.warn("Elemento 'historicalChart' não encontrado. Gráfico histórico não será renderizado.");
    }


    // --- Gráfico de Projeção de Vendas ---
    const projectionDataPoints = [];
    const numFuturePeriods = 3; // Projetar para 3 períodos futuros

    if (historicalMetricData.length > 0) {
        const lastDataPoint = historicalMetricData[historicalMetricData.length - 1];
        const lastDate = new Date(lastDataPoint.x);
        const lastValue = lastDataPoint.y;

        // Projeção linear simples: assume que o próximo valor é igual ao último
        for (let i = 1; i <= numFuturePeriods; i++) {
            let nextDate = new Date(lastDate);
            let nextDateKey;
            if (period === 'daily') {
                nextDate.setDate(lastDate.getDate() + i);
                nextDateKey = nextDate.toISOString().split('T')[0];
            } else if (period === 'weekly') {
                nextDate.setDate(lastDate.getDate() + (i * 7));
                nextDateKey = nextDate.toISOString().split('T')[0];
            } else if (period === 'monthly') {
                nextDate.setMonth(lastDate.getMonth() + i);
                nextDateKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-01`;
            }
            projectionDataPoints.push({ x: nextDateKey, y: lastValue }); // Adiciona como objeto {x,y}
        }
    }

    const projectionCanvas = document.getElementById('projectionChart');
    if (projectionCanvas) { // Verifica se o canvas existe
        const ctxProjection = projectionCanvas.getContext('2d');
        projectionChart = new Chart(ctxProjection, {
            type: 'line',
            data: {
                labels: labelsForChart.concat(projectionDataPoints.map(item => item.x)), // Combina labels históricos e de projeção
                datasets: [{
                    label: historicalMetricLabel + ' (Histórico)',
                    data: historicalMetricData, // Passa os objetos {x,y}
                    borderColor: 'rgb(0, 72, 72)',
                    backgroundColor: 'rgba(0, 72, 72, 0.2)',
                    fill: false,
                    tension: 0.1
                }, {
                    label: historicalMetricLabel + ' (Projeção)',
                    // Cria um array com nulls para o histórico e depois a projeção
                    data: Array(historicalMetricData.length - 1).fill(null).concat([historicalMetricData[historicalMetricData.length - 1]], projectionDataPoints),
                    borderColor: 'rgb(255, 99, 132)', // CORREÇÃO AQUI: Adicionado o parêntese e aspa
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            parser: 'yyyy-MM-dd', // Explicitamente define o parser para o formato ISO
                            unit: period === 'daily' ? 'day' : (period === 'weekly' ? 'week' : 'month'),
                            tooltipFormat: period === 'daily' ? 'dd/MM/yyyy' : (period === 'weekly' ? 'dd/MM/yyyy' : 'MM/yyyy'),
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
                        title: {
                            display: true,
                            text: historicalMetricLabel
                        },
                        ticks: {
                            callback: function(value) {
                                return historicalMetricFormat(value);
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
                                    label += historicalMetricFormat(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    } else {
        console.warn("Elemento 'projectionChart' não encontrado. Gráfico de projeção não será renderizado.");
    }
}

function updateTable(data) {
    const tableBody = document.getElementById('salesTableBody');
    if (!tableBody) {
        console.error("Elemento 'salesTableBody' não encontrado.");
        return;
    }
    tableBody.innerHTML = ''; // Limpa a tabela existente

    // Limita a exibição a um número razoável de linhas para evitar sobrecarga
    const displayLimit = 500;
    const dataToDisplay = data.slice(0, displayLimit);

    dataToDisplay.forEach(item => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = item.Data.toLocaleDateString('pt-BR');
        row.insertCell().textContent = item.Medicamento;
        row.insertCell().textContent = item.Categoria;
        row.insertCell().textContent = formatNumber(item.Quantidade);
        row.insertCell().textContent = formatCurrency(item['Preço Unitário']);
        row.insertCell().textContent = formatCurrency(item['Preço Total']);
        row.insertCell().textContent = item.Cidade;
        row.insertCell().textContent = item.Vendedor;
    });

    document.getElementById('tableTitle').textContent = `📋 Detalhamento Diário (Máximo ${dataToDisplay.length} linhas)`;
    if (data.length > displayLimit) {
        console.warn(`Exibindo apenas as primeiras ${displayLimit} linhas. Total de registros: ${data.length}`);
    }
}

function updateLastUpdateDate() {
    const lastUpdateDateElement = document.getElementById('lastUpdateDate');
    if (lastUpdateDateElement) {
        const now = new Date();
        const options = {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        };
        lastUpdateDateElement.textContent = now.toLocaleDateString('pt-BR', options);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadCSV();

    // Adiciona event listeners para os filtros
    document.getElementById('filterCidade').addEventListener('change', () => {
        applyFilters();
        updateDependentFilters(); // Atualiza os filtros dependentes
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
    document.getElementById('projectionMetric').addEventListener('change', applyFilters);
    document.getElementById('clearBtn').addEventListener('click', clearFilters);
});
