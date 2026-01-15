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

            // --- CORREÇÃO AQUI: Ajustar o parsing do Preço para o formato "X.YY" ---
            let rawPrice = row['Preço'].replace('R$', '').trim();
            // Se o formato é R$ 8.50 (oito e cinquenta), o ponto já é o decimal.
            // Apenas precisamos garantir que não haja outros pontos ou vírgulas inesperadas.
            // Para o formato R$ X.YY, parseFloat já deve funcionar se o ponto for o decimal.
            // Se houver R$ X.XXX.YY (ponto milhar e ponto decimal), a lógica seria mais complexa.
            // Pelo seu print, parece ser R$ X.YY (ponto decimal).
            let precoUnitario = parseFloat(rawPrice);
            // --- FIM DA CORREÇÃO ---

            if (isNaN(precoUnitario)) precoUnitario = 0;
            row['Preço Unitário'] = precoUnitario;

            let quantidade = parseInt(row['Quantidade']);
            if (isNaN(quantidade)) quantidade = 1;
            row['Quantidade'] = quantidade;

            row['Preço Total'] = precoUnitario * quantidade;

            allData.push(row);
        }

        console.log('CSV carregado com sucesso:', allData.length, 'registros');
        initializeFilters();
        updateDashboard(allData);
    } catch (error) {
        console.error('Erro ao fazer parsing do CSV:', error);
        alert('Erro ao processar dados.');
    }
}

function getUniqueValues(data, column) {
    const values = data.map(row => row[column]).filter(v => v);
    return [...new Set(values)].sort();
}

function populateSelect(selectId, values, defaultText) {
    const select = document.getElementById(selectId);
    select.innerHTML = `<option value="all">${defaultText}</option>`;
    values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });
}

function initializeFilters() {
    const cidades = getUniqueValues(allData, 'Cidade');
    populateSelect('filterCidade', cidades, 'Todas as Cidades');
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
    updateTable(data);
}

function updateStats(data) {
    const totalSales = data.length;
    const totalRevenue = data.reduce((sum, row) => sum + row['Preço Total'], 0);
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    const productCounts = {};
    data.forEach(row => {
        const med = row['Medicamento'];
        productCounts[med] = (productCounts[med] || 0) + 1;
    });

    const topProduct = Object.keys(productCounts).length > 0
        ? Object.keys(productCounts).reduce((a, b) => productCounts[a] > productCounts[b] ? a : b)
        : '-';

    document.getElementById('totalSales').textContent = formatNumber(totalSales);
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('avgTicket').textContent = formatCurrency(avgTicket);
    document.getElementById('topProduct').textContent = topProduct;
}

function updateCharts(data) {
    const dailyData = {};
    data.forEach(row => {
        const date = row['Data'];
        if (!dailyData[date]) {
            dailyData[date] = 0;
        }
        dailyData[date] += row['Preço Total'];
    });

    const sortedDates = Object.keys(dailyData).sort();
    const revenues = sortedDates.map(date => dailyData[date]);

    // Gráfico Histórico
    const ctxHistorical = document.getElementById('historicalChart');
    if (historicalChart) historicalChart.destroy();

    historicalChart = new Chart(ctxHistorical, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: 'Receita Diária',
                data: revenues,
                borderColor: 'rgb(0, 72, 72)',
                backgroundColor: 'rgba(0, 72, 72, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Receita: ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });

    // Gráfico Projeção (média móvel simples)
    const projectionDays = 7;
    const lastRevenues = revenues.slice(-projectionDays);
    const avgRevenue = lastRevenues.reduce((a, b) => a + b, 0) / lastRevenues.length;

    const projectionLabels = [];
    const projectionData = [];

    for (let i = 1; i <= projectionDays; i++) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + i);
        projectionLabels.push(futureDate.toISOString().split('T')[0]);
        projectionData.push(avgRevenue);
    }

    const ctxProjection = document.getElementById('projectionChart');
    if (

