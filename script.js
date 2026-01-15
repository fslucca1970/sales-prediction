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

            // CORREÇÃO DA VÍRGULA AQUI (mantida a correção que funcionou)
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
        // Chamada inicial para popular todos os filtros e o dashboard
        updateAllFiltersAndDashboard();

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
    // AQUI ESTÁ A MUDANÇA: O filtro só é desabilitado se não houver NENHUMA opção além da padrão
    select.disabled = (options.length === 0); 
}

// Nova função para atualizar todos os filtros e o dashboard
function updateAllFiltersAndDashboard() {
    let currentFilteredData = allData;

    const cidade = document.getElementById('filterCidade').value;
    const categoria = document.getElementById('filterCategoria').value;
    const medicamento = document.getElementById('filterMedicamento').value;
    const vendedor = document.getElementById('filterVendedor').value;

    // Aplica os filtros selecionados para determinar as opções dos próximos
    if (cidade !== 'all') {
        currentFilteredData = currentFilteredData.filter(row => row['Cidade'] === cidade);
    }
    // Popula Categoria
    const categorias = getUniqueValues(currentFilteredData, 'Categoria');
    populateSelect('filterCategoria', categorias, 'Todas as Categorias');
    // Mantém a seleção atual se ainda for válida
    if (categoria !== 'all' && categorias.includes(categoria)) {
        document.getElementById('filterCategoria').value = categoria;
    } else {
        document.getElementById('filterCategoria').value = 'all';
    }

    // Aplica o filtro de Categoria para determinar as opções dos próximos
    if (categoria !== 'all') {
        currentFilteredData = currentFilteredData.filter(row => row['Categoria'] === categoria);
    }
    // Popula Medicamento
    const medicamentos = getUniqueValues(currentFilteredData, 'Medicamento');
    populateSelect('filterMedicamento', medicamentos, 'Todos os Medicamentos');
    // Mantém a seleção atual se ainda for válida
    if (medicamento !== 'all' && medicamentos.includes(medicamento)) {
        document.getElementById('filterMedicamento').value = medicamento;
    } else {
        document.getElementById('filterMedicamento').value = 'all';
    }

    // Aplica o filtro de Medicamento para determinar as opções dos próximos
    if (medicamento !== 'all') {
        currentFilteredData = currentFilteredData.filter(row => row['Medicamento'] === medicamento);
    }
    // Popula Vendedor
    const vendedores = getUniqueValues(currentFilteredData, 'Vendedor');
    populateSelect('filterVendedor', vendedores, 'Todos os Vendedores');
    // Mantém a seleção atual se ainda for válida
    if (vendedor !== 'all' && vendedores.includes(vendedor)) {
        document.getElementById('filterVendedor').value = vendedor;
    } else {
        document.getElementById('filterVendedor').value = 'all';
    }

    // Finalmente, aplica TODOS os filtros selecionados para atualizar o dashboard
    applyFilters();
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

    const topProduct = Object.keys(productCounts).length > 0
        ? Object.keys(productCounts).reduce((a, b) => productCounts[a] > productCounts[b] ? a : b)
        : '-';

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

    // Event Listeners para os filtros
    document.getElementById('filterCidade').addEventListener('change', updateAllFiltersAndDashboard);
    document.getElementById('filterCategoria').addEventListener('change', updateAllFiltersAndDashboard);
    document.getElementById('filterMedicamento').addEventListener('change', updateAllFiltersAndDashboard);
    document.getElementById('filterVendedor').addEventListener('change', updateAllFiltersAndDashboard);

    document.getElementById('clearBtn').addEventListener('click', function() {
        document.getElementById('filterCidade').value = 'all';
        document.getElementById('filterCategoria').value = 'all';
        document.getElementById('filterMedicamento').value = 'all';
        document.getElementById('filterVendedor').value = 'all';

        // Chama a função para resetar e repopular todos os filtros e o dashboard
        updateAllFiltersAndDashboard();
    });
});
 
