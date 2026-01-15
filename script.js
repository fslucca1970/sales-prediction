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

            // CORREÇÃO DA VÍRGULA AQUI
            let rawPrice = row['Preço'].replace('R$', '').trim();
            rawPrice = rawPrice.replace(/\./g, '').replace(',', '.');
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
    select.innerHTML = `<option value="all">${defaultText}</option>`;
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        select.appendChild(opt);
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
        const prod = row['Medicamento'];
        productCounts[prod] = (productCounts[prod] || 0) + 1;
    });

    const topProduct = Object.keys(productCounts).reduce((a, b) => 
        productCounts[a] > productCounts[b] ? a : b, 'N/A'
    );

    document.getElementById('totalSales').textContent = formatNumber(totalSales);
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('avgTicket').textContent = formatCurrency(avgTicket);
    document.getElementById('topProduct').textContent = topProduct;
}

function updateCharts(data) {
    const salesByDate = {};
    data.forEach(row => {
        const date = row['Data'];
        salesByDate[date] = (salesByDate[date] || 0) + row['Preço Total'];
    });

    const sortedDates = Object.keys(salesByDate).sort();
    const revenues = sortedDates.map(date => salesByDate[date]);

    const ctx1 = document.getElementById('historicalChart');
    if (historicalChart) historicalChart.destroy();
    historicalChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: sortedDates,
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

    const lastRevenue = revenues[revenues.length - 1] || 0;
    const projectionDays = 7;
    const projectionLabels = [];
    const projectionData = [];

    for (let i = 1; i <= projectionDays; i++) {
        projectionLabels.push(`+${i}d`);
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

function updateTable(data) {
    const tbody = document.getElementById('salesTableBody');
    tbody.innerHTML = '';

    const limitedData = data.slice(0, 500);

    limitedData.forEach(row => {
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
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado. Iniciando...');
    loadCSV();

    document.getElementById('filterCidade').addEventListener('change', function() {
        let filtered = allData;

        if (this.value !== 'all') {
            filtered = filtered.filter(row => row['Cidade'] === this.value);
        }

        const categorias = getUniqueValues(filtered, 'Categoria');
        populateSelect('filterCategoria', categorias, 'Todas as Categorias');
        document.getElementById('filterCategoria').disabled = (categorias.length === 0);

        document.getElementById('filterMedicamento').innerHTML = '<option value="all">Todos os Medicamentos</option>';
        document.getElementById('filterMedicamento').disabled = true;
        document.getElementById('filterVendedor').innerHTML = '<option value="all">Todos os Vendedores</option>';
        document.getElementById('filterVendedor').disabled = true;

        applyFilters();
    });

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
        document.getElementById('filterMedicamento').disabled = (medicamentos.length === 0);

        document.getElementById('filterVendedor').innerHTML = '<option value="all">Todos os Vendedores</option>';
        document.getElementById('filterVendedor').disabled = true;

        applyFilters();
    });

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
        document.getElementById('filterVendedor').disabled = (vendedores.length === 0);

        applyFilters();
    });

    document.getElementById('filterVendedor').addEventListener('change', function() {
        applyFilters();
    });

    document.getElementById('clearBtn').addEventListener('click', function() {
        document.getElementById('filterCidade').value = 'all';
        document.getElementById('filterCategoria').value = 'all';
        document.getElementById('filterMedicamento').value = 'all';
        document.getElementById('filterVendedor').value = 'all';

        document.getElementById('filterCategoria').disabled = true;
        document.getElementById('filterMedicamento').disabled = true;
        document.getElementById('filterVendedor').disabled = true;

        initializeFilters();
        updateDashboard(allData);
    });
});
