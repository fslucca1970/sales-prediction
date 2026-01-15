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
            row['Data'] = date;

            // Correção CRÍTICA: Usar 'Preço' do CSV para Preço Unitário
            let precoUnitarioRaw = String(row['Preço']).replace('R$', '').replace('.', '').replace(',', '.').trim();
            const precoUnitario = parseFloat(precoUnitarioRaw);
            if (isNaN(precoUnitario)) {
                console.warn(`Linha ${i + 1}: Preço Unitário inválido "${row['Preço']}". Linha ignorada.`);
                isValidRow = false;
            }
            row['Preço Unitário'] = precoUnitario; // Armazenar como 'Preço Unitário' para consistência interna

            let quantidadeRaw = String(row['Quantidade']).replace('.', '').replace(',', '.').trim();
            const quantidade = parseInt(quantidadeRaw, 10);
            if (isNaN(quantidade)) {
                console.warn(`Linha ${i + 1}: Quantidade inválida "${row['Quantidade']}". Linha ignorada.`);
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
        document.getElementById('lastUpdateDate').textContent = new Date().toLocaleDateString('pt-BR');

        initializeFilters();
        applyFilters(); // Aplica os filtros iniciais e renderiza tudo
    } catch (error) {
        console.error('Erro ao processar dados do CSV:', error);
        alert('Erro ao processar dados do CSV. Verifique o console para mais detalhes.');
    }
}

function initializeFilters() {
    const cidades = [...new Set(allData.map(item => item['Cidade']))].sort();
    const categorias = [...new Set(allData.map(item => item['Categoria']))].sort();
    const medicamentos = [...new Set(allData.map(item => item['Medicamento']))].sort();
    const vendedores = [...new Set(allData.map(item => item['Vendedor']))].sort();

    populateSelect('filterCidade', cidades, 'Todas as Cidades');
    populateSelect('filterCategoria', categorias, 'Todas as Categorias');
    populateSelect('filterMedicamento', medicamentos, 'Todos os Medicamentos');
    populateSelect('filterVendedor', vendedores, 'Todos os Vendedores');

    // Habilita os filtros após populá-los
    document.getElementById('filterCidade').disabled = false;
    document.getElementById('filterCategoria').disabled = false;
    document.getElementById('filterMedicamento').disabled = false;
    document.getElementById('filterVendedor').disabled = false;
}

function populateSelect(elementId, items, defaultOptionText) {
    const select = document.getElementById(elementId);
    select.innerHTML = `<option value="all">${defaultOptionText}</option>`; // Limpa e adiciona opção padrão

    items.forEach(item => {
        const option = document.createElement('option'); // Corrigido de RcreateElement
        option.value = item;
        option.textContent = item;
        select.appendChild(option);
    });
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
    if (selectedCategoria !== 'all') {
        filtered = filtered.filter(item => item['Categoria'] === selectedCategoria);
    }
    if (selectedMedicamento !== 'all') {
        filtered = filtered.filter(item => item['Medicamento'] === selectedMedicamento);
    }
    if (selectedVendedor !== 'all') {
        filtered = filtered.filter(item => item['Vendedor'] === selectedVendedor);
    }

    const categorias = [...new Set(filtered.map(item => item['Categoria']))].sort();
    const medicamentos = [...new Set(filtered.map(item => item['Medicamento']))].sort();
    const vendedores = [...new Set(filtered.map(item => item['Vendedor']))].sort();

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
    const selectedPeriodo = document.getElementById('filterPeriodo').value;

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
    renderCharts(filteredData, selectedPeriodo);
    updateTable(filteredData); // Chamada correta para a função de atualização da tabela
}

function clearFilters() {
    document.getElementById('filterCidade').value = 'all';
    document.getElementById('filterCategoria').value = 'all';
    document.getElementById('filterMedicamento').value = 'all';
    document.getElementById('filterVendedor').value = 'all';
    document.getElementById('filterPeriodo').value = 'daily';
    document.getElementById('projectionMetric').value = 'revenue'; // Reseta a métrica de projeção também
    updateDependentFilters(); // Reseta os filtros dependentes
    applyFilters();
}

function updateStats(data) {
    const totalSales = data.length;
    const totalRevenue = data.reduce((sum, item) => sum + item['Preço Total'], 0);
    const totalUnits = data.reduce((sum, item) => sum + item['Quantidade'], 0);
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    const productCounts = {};
    data.forEach(item => {
        productCounts[item['Medicamento']] = (productCounts[item['Medicamento']] || 0) + item['Quantidade'];
    });

    const topProduct = Object.keys(productCounts).length > 0
        ? Object.keys(productCounts).sort((a, b) => productCounts[b] - productCounts[a])[0]
        : 'N/A';

    document.getElementById('totalSales').textContent = formatNumber(totalSales);
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('avgTicket').textContent = formatCurrency(avgTicket);
    document.getElementById('topProduct').textContent = topProduct;
}

function aggregateData(data, period) {
    const aggregated = {};

    data.forEach(item => {
        let key;
        const date = item['Data'];

        if (period === 'daily') {
            key = date.toISOString().split('T')[0]; // YYYY-MM-DD
        } else if (period === 'weekly') {
            // Calcula o início da semana (domingo)
            const d = new Date(date);
            d.setDate(d.getDate() - d.getDay()); // Volta para o domingo
            key = d.toISOString().split('T')[0];
        } else if (period === 'monthly') {
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
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
    return Object.values(aggregated).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function renderCharts(data, period) {
    const aggregated = aggregateData(data, period);
    const labels = aggregated.map(item => item.date);
    const revenueData = aggregated.map(item => item.revenue);
    const unitsData = aggregated.map(item => item.units);

    const projectionMetric = document.getElementById('projectionMetric').value;
    const historicalMetricData = projectionMetric === 'revenue' ? revenueData : unitsData;
    const historicalMetricLabel = projectionMetric === 'revenue' ? 'Receita (R$)' : 'Unidades';
    const historicalMetricFormat = projectionMetric === 'revenue' ? formatCurrency : formatNumber;

    // Destruir gráficos existentes se houver
    if (historicalChart) historicalChart.destroy();
    if (projectionChart) projectionChart.destroy();

    const ctxHistorical = document.getElementById('historicalChart').getContext('2d');
    historicalChart = new Chart(ctxHistorical, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: historicalMetricLabel,
                data: historicalMetricData,
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

    // Projeção (usando uma projeção linear simples para demonstração)
    const projectionLabels = [];
    const projectionData = [];
    const numFuturePeriods = 3; // Projetar para 3 períodos futuros

    if (aggregated.length > 0) {
        const lastDate = new Date(aggregated[aggregated.length - 1].date);
        const lastValue = historicalMetricData[historicalMetricData.length - 1];

        // Projeção linear simples: assume que o próximo valor é igual ao último
        for (let i = 1; i <= numFuturePeriods; i++) {
            let nextDate = new Date(lastDate);
            if (period === 'daily') {
                nextDate.setDate(lastDate.getDate() + i);
                projectionLabels.push(nextDate.toISOString().split('T')[0]);
            } else if (period === 'weekly') {
                nextDate.setDate(lastDate.getDate() + (i * 7));
                projectionLabels.push(nextDate.toISOString().split('T')[0]);
            } else if (period === 'monthly') {
                nextDate.setMonth(lastDate.getMonth() + i);
                projectionLabels.push(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
            }
            projectionData.push(lastValue); // Mantém o último valor para projeção simples
        }
    }

    const ctxProjection = document.getElementById('projectionChart').getContext('2d');
    projectionChart = new Chart(ctxProjection, {
        type: 'line',
        data: {
            labels: [...labels, ...projectionLabels],
            datasets: [{
                label: historicalMetricLabel + ' (Histórico)',
                data: historicalMetricData,
                borderColor: 'rgb(0, 72, 72)',
                backgroundColor: 'rgba(0, 72, 72, 0.2)',
                fill: false,
                tension: 0.1
            }, {
                label: historicalMetricLabel + ' (Projeção)',
                data: Array(labels.length - 1).fill(null).concat([historicalMetricData[historicalMetricData.length - 1]], projectionData),
                borderColor: 'rgb(255, 99, 132)',
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
}

function updateTable(data) {
    const tableBody = document.getElementById('salesTableBody');
    tableBody.innerHTML = ''; // Limpa a tabela

    // Limita a exibição a um número razoável de linhas para evitar sobrecarga
    const displayData = data.slice(0, 500);

    displayData.forEach(item => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = item['Data'].toLocaleDateString('pt-BR');
        row.insertCell().textContent = item['Medicamento'];
        row.insertCell().textContent = item['Categoria'];
        row.insertCell().textContent = formatNumber(item['Quantidade']);
        row.insertCell().textContent = formatCurrency(item['Preço Unitário']); // Usar o valor parseado
        row.insertCell().textContent = formatCurrency(item['Preço Total']); // Usar o valor calculado
        row.insertCell().textContent = item['Cidade'];
        row.insertCell().textContent = item['Vendedor'];
    });

    document.getElementById('tableTitle').textContent = `📋 Detalhamento Diário (Máximo ${displayData.length} linhas)`;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadCSV();

    // Event listeners para os filtros
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
