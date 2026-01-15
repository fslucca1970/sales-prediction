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

        let separator = ',';
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
                continue;
            }

            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });

            // Usa a função robusta para parsear a data
            const parsedDate = parseDateString(row['Data']);
            if (isNaN(parsedDate.getTime())) {
                console.warn(`Linha ${i + 1} ignorada (data): Data inválida encontrada: '${row['Data']}'. Linha: "${lines[i]}"`);
                invalidDateCount++;
                continue;
            }
            row['ParsedDate'] = parsedDate;

            // Tratamento de Preço Unitário
            let precoUnitarioRaw = row['Preço'] ? row['Preço'].replace('R$', '').replace(/\./g, '').replace(',', '.') : '0';
            let precoUnitario = parseFloat(precoUnitarioRaw);
            if (isNaN(precoUnitario)) {
                console.warn(`Linha ${i + 1} (preço unitário): Preço unitário inválido: '${row['Preço']}'. Usando 0.`);
                invalidPriceCount++;
                precoUnitario = 0;
            }
            row['Preço Unitário'] = precoUnitario;

            // Tratamento de Quantidade
            let quantidadeRaw = row['Quantidade'] ? row['Quantidade'].replace(/\./g, '').replace(',', '.') : '0';
            let quantidade = parseInt(quantidadeRaw);
            if (isNaN(quantidade)) {
                console.warn(`Linha ${i + 1} (quantidade): Quantidade inválida: '${row['Quantidade']}'. Usando 1.`);
                invalidQuantityCount++;
                quantidade = 1;
            }
            row['Quantidade'] = quantidade;

            row['Preço Total'] = precoUnitario * quantidade;

            allData.push(row);
        }

        console.log(`CSV carregado com sucesso: ${allData.length} registros válidos.`);
        if (invalidDateCount > 0) console.warn(`${invalidDateCount} linhas ignoradas devido a datas inválidas.`);
        if (invalidPriceCount > 0) console.warn(`${invalidPriceCount} preços inválidos foram definidos como 0.`);
        if (invalidQuantityCount > 0) console.warn(`${invalidQuantityCount} quantidades inválidas foram definidas como 1.`);
        if (columnMismatchCount > 0) console.warn(`${columnMismatchCount} linhas ignoradas devido a número incorreto de colunas.`);

        if (allData.length === 0) {
            alert('Nenhum dado válido encontrado no CSV após o processamento.');
            return;
        }

        // Ordena os dados por data para garantir a cronologia dos gráficos
        allData.sort((a, b) => a.ParsedDate - b.ParsedDate);

        initializeFilters();
        applyFilters(); // Aplica os filtros e renderiza o dashboard inicial
        updateLastUpdateDate();

    } catch (error) {
        console.error('Erro ao processar dados do CSV:', error);
        alert('Erro ao processar dados do CSV. Verifique o console para mais detalhes.');
    }
}

function getUniqueValues(data, key) {
    const values = [...new Set(data.map(item => item[key]))].filter(Boolean); // Remove valores vazios/nulos
    return values.sort();
}

function populateSelect(elementId, values, defaultOptionText) {
    const select = document.getElementById(elementId);
    if (!select) {
        console.error(`Elemento com ID '${elementId}' não encontrado.`);
        return;
    }
    const currentSelection = select.value;
    select.innerHTML = `<option value="all">${defaultOptionText}</option>`;
    values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });
    if (values.includes(currentSelection) || currentSelection === 'all') {
        select.value = currentSelection;
    } else {
        select.value = 'all';
    }
    select.disabled = values.length === 0;
}

function initializeFilters() {
    populateSelect('filterCidade', getUniqueValues(allData, 'Cidade'), 'Todas as Cidades');
    populateSelect('filterCategoria', getUniqueValues(allData, 'Categoria'), 'Todas as Categorias');
    populateSelect('filterMedicamento', getUniqueValues(allData, 'Medicamento'), 'Todos os Medicamentos');
    populateSelect('filterVendedor', getUniqueValues(allData, 'Vendedor'), 'Todos os Vendedores');
}

function applyFilters() {
    let filteredData = [...allData];

    const selectedCidade = document.getElementById('filterCidade').value;
    const selectedCategoria = document.getElementById('filterCategoria').value;
    const selectedMedicamento = document.getElementById('filterMedicamento').value;
    const selectedVendedor = document.getElementById('filterVendedor').value;
    const selectedPeriodo = document.getElementById('filterPeriodo').value;

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

    updateStats(filteredData);
    renderSalesTable(filteredData);
    renderCharts(filteredData, selectedPeriodo);
}

function clearFilters() {
    document.getElementById('filterCidade').value = 'all';
    document.getElementById('filterCategoria').value = 'all';
    document.getElementById('filterMedicamento').value = 'all';
    document.getElementById('filterVendedor').value = 'all';
    document.getElementById('filterPeriodo').value = 'daily';
    document.getElementById('projectionMetric').value = 'revenue';
    updateDependentFilters();
    applyFilters();
}

function updateStats(data) {
    const totalSales = data.length;
    const totalRevenue = data.reduce((sum, row) => sum + row['Preço Total'], 0);
    const totalUnits = data.reduce((sum, row) => sum + row['Quantidade'], 0);
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    const productSales = {};
    data.forEach(row => {
        productSales[row['Medicamento']] = (productSales[row['Medicamento']] || 0) + row['Quantidade'];
    });
    const topProduct = Object.keys(productSales).sort((a, b) => productSales[b] - productSales[a])[0] || 'N/A';

    document.getElementById('totalSales').textContent = formatNumber(totalSales);
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('avgTicket').textContent = formatCurrency(averageTicket); // Corrigido ID
    document.getElementById('topProduct').textContent = topProduct;
}

function aggregateDataByPeriod(data, period) {
    const grouped = {};

    data.forEach(row => {
        let key;
        const date = row.ParsedDate;

        if (period === 'daily') {
            key = date.toISOString().split('T')[0]; // YYYY-MM-DD
        } else if (period === 'weekly') {
            const startOfWeek = new Date(date);
            startOfWeek.setDate(date.getDate() - date.getDay()); // Domingo como início da semana
            key = startOfWeek.toISOString().split('T')[0];
        } else if (period === 'monthly') {
            key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        } else { // Default to daily
            key = date.toISOString().split('T')[0];
        }

        if (!grouped[key]) {
            grouped[key] = {
                date: key,
                periodoDisplay: (period === 'daily' ? date.toLocaleDateString('pt-BR') : 
                                 period === 'weekly' ? `Semana de ${new Date(key).toLocaleDateString('pt-BR')}` :
                                 new Date(key + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })),
                revenue: 0,
                units: 0,
                medicamentos: new Set(),
                categorias: new Set(),
                cidades: new Set(),
                vendedores: new Set(),
                originalRows: []
            };
        }
        grouped[key].revenue += row['Preço Total'];
        grouped[key].units += row['Quantidade'];
        grouped[key].medicamentos.add(row['Medicamento']);
        grouped[key].categorias.add(row['Categoria']);
        grouped[key].cidades.add(row['Cidade']);
        grouped[key].vendedores.add(row['Vendedor']);
        grouped[key].originalRows.push(row);
    });

    const aggregatedArray = Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
    return aggregatedArray;
}

function renderCharts(data, period) {
    const aggregatedData = aggregateDataByPeriod(data, period);

    const labels = aggregatedData.map(item => item.periodoDisplay); // Usar periodoDisplay para os rótulos
    const historicalRevenueValues = aggregatedData.map(item => item.revenue);
    const historicalUnitsValues = aggregatedData.map(item => item.units);

    console.log("Labels para gráficos (Histórico):", labels);
    console.log("Valores de Receita Histórica:", historicalRevenueValues);
    console.log("Valores de Unidades Históricas:", historicalUnitsValues);

    // --- Histórico de Vendas ---
    const historicalCanvas = document.getElementById('historicalChart'); // ID correto
    if (!historicalCanvas) {
        console.error("Elemento 'historicalChart' não encontrado.");
        return;
    }
    const ctxHistorical = historicalCanvas.getContext('2d');
    if (historicalChart) {
        historicalChart.destroy();
    }

    if (labels.length > 0 && historicalRevenueValues.length > 0) {
        historicalChart = new Chart(ctxHistorical, {
            type: 'bar', // Pode ser 'line' ou 'bar'
            data: {
                labels: labels,
                datasets: [{
                    label: 'Receita (R$)',
                    data: historicalRevenueValues,
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
    } else {
        console.warn("Dados insuficientes para renderizar o gráfico histórico.");
        ctxHistorical.clearRect(0, 0, historicalCanvas.width, historicalCanvas.height);
        ctxHistorical.font = "16px Arial";
        ctxHistorical.textAlign = "center";
        ctxHistorical.fillStyle = "#666";
        ctxHistorical.fillText("Sem dados para exibir o histórico.", historicalCanvas.width / 2, historicalCanvas.height / 2);
    }


    // --- Projeção de Vendas ---
    const projectionCanvas = document.getElementById('projectionChart'); // ID correto
    if (!projectionCanvas) {
        console.error("Elemento 'projectionChart' não encontrado.");
        return;
    }
    const ctxProjection = projectionCanvas.getContext('2d');
    if (projectionChart) {
        projectionChart.destroy();
    }

    const projectionMetric = document.getElementById('projectionMetric').value;
    const projectionTitle = projectionMetric === 'revenue' ? 'Projeção (Receita R$)' : 'Projeção (Unidades)';
    const historicalDataForProjection = projectionMetric === 'revenue' ? historicalRevenueValues : historicalUnitsValues;

    let projectionValues = [];
    let projectionLabels = [];

    if (historicalDataForProjection.length > 0) {
        const lastDataPointValue = historicalDataForProjection[historicalDataForProjection.length - 1];
        const lastAggregatedItem = aggregatedData[aggregatedData.length - 1];
        const lastDate = new Date(lastAggregatedItem.date); // Usar a data do item agregado

        for (let i = 1; i <= 3; i++) {
            let nextDate = new Date(lastDate);
            let projectedValue = lastDataPointValue; // Projeção simples: mantém o último valor

            let nextLabel;
            if (period === 'daily') {
                nextDate.setDate(lastDate.getDate() + i);
                nextLabel = `+${i} dia`;
            } else if (period === 'weekly') {
                nextDate.setDate(lastDate.getDate() + (i * 7));
                nextLabel = `+${i} semana`;
            } else if (period === 'monthly') {
                nextDate.setMonth(lastDate.getMonth() + i);
                nextLabel = `+${i} mês`;
            }
            projectionLabels.push(nextLabel);
            // Adiciona uma pequena variação aleatória à média para a projeção
            projectedValue = projectedValue * (1 + (Math.random() - 0.5) * 0.1); // +/- 5% de variação
            projectionValues.push(Math.max(0, Math.round(projectedValue)));
        }
    }

    console.log("Labels para Projeção:", projectionLabels);
    console.log("Valores para Projeção:", projectionValues);

    if (projectionLabels.length > 0 && projectionValues.length > 0) {
        projectionChart = new Chart(ctxProjection, {
            type: 'line',
            data: {
                labels: projectionLabels,
                datasets: [{
                    label: projectionTitle,
                    data: projectionValues,
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2,
                    fill: false,
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
                            text: 'Período'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: projectionMetric === 'revenue' ? 'Receita Projetada (R$)' : 'Unidades Projetadas'
                        },
                        ticks: {
                            callback: function(value) {
                                return projectionMetric === 'revenue' ? formatCurrency(value) : formatNumber(value);
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
                                    label += projectionMetric === 'revenue' ? formatCurrency(context.parsed.y) : formatNumber(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    } else {
        console.warn("Dados insuficientes para renderizar o gráfico de projeção.");
        ctxProjection.clearRect(0, 0, projectionCanvas.width, projectionCanvas.height);
        ctxProjection.font = "16px Arial";
        ctxProjection.textAlign = "center";
        ctxProjection.fillStyle = "#666";
        ctxProjection.fillText("Sem dados para exibir a projeção.", projectionCanvas.width / 2, projectionCanvas.height / 2);
    }
}

function updateTable(originalFilteredData, groupedData, period) {
    const tableBody = document.getElementById('salesTableBody');
    if (!tableBody) {
        console.error("Elemento 'salesTableBody' não encontrado.");
        return;
    }
    tableBody.innerHTML = '';

    const tableTitle = document.getElementById('tableTitle');
    let titleText = '📋 Detalhamento ';

    let dataToDisplay = [];

    if (period === 'daily') {
        titleText += 'Diário';
        dataToDisplay = originalFilteredData.slice(0, 500);
    } else {
        titleText += period === 'weekly' ? 'Semanal' : 'Mensal';
        dataToDisplay = groupedData.map(g => ({
            'Data': g.periodoDisplay, // Usar o display formatado
            'Medicamento': Array.from(g.medicamentos).join(', '),
            'Categoria': Array.from(g.categorias).join(', '),
            'Quantidade': g.units,
            'Preço Unitário': g.revenue / g.units || 0,
            'Preço Total': g.revenue,
            'Cidade': Array.from(g.cidades).join(', '),
            'Vendedor': Array.from(g.vendedores).join(', ')
        })).slice(0, 500);
    }

    tableTitle.textContent = `${titleText} (Máximo ${dataToDisplay.length} linhas)`;

    const tableHeadRow = document.getElementById('salesTable').querySelector('thead tr');
    if (!tableHeadRow) {
        console.error("Elemento 'salesTable thead tr' não encontrado.");
        return;
    }
    tableHeadRow.innerHTML = '';

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
                <td>${formatCurrency(row['Preço Total'])}</td>
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
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        };
        lastUpdateDateElement.textContent = now.toLocaleDateString('pt-BR', options);
    }
}

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

document.addEventListener('DOMContentLoaded', () => {
    loadCSV();

    document.getElementById('filterCidade').addEventListener('change', () => {
        applyFilters();
        updateDependentFilters();
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
