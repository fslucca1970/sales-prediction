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

            // --- CORREÇÃO AQUI: Ajustar o parsing do Preço para o formato "X.YY" (ponto decimal) ---
            let rawPrice = row['Preço'].replace('R$', '').trim();
            // Pelo seu CSV, o ponto JÁ É o separador decimal. Não precisamos remover pontos de milhar
            // nem substituir vírgulas. Apenas converter diretamente após remover o "R$".
            let precoUnitario = parseFloat(rawPrice); // Esta é a linha crucial!
            // --- FIM DA CORREÇÃO ---

            if (isNaN(precoUnitario)) precoUnitario = 0;
            row['Preço Unitário'] = precoUnitario;

            let quantidade = parseInt(row['Quantidade']) || 1;
            row['Quantidade'] = quantidade;

            row['Preço Total'] = precoUnitario * quantidade;

            allData.push(row);
        }

        console.log(`CSV carregado com sucesso: ${allData.length} registros`);
        initializeFilters(); // Agora esta função vai popular TODOS os filtros
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
    // Remove a desabilitação inicial, pois os filtros serão sempre populados
    select.disabled = false; 
}

// Modificado: Agora initializeFilters popula TODOS os filtros na carga inicial
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
    // Cada filtro agora apenas chama applyFilters e repopula os outros filtros com base nos dados filtrados
    // Isso permite que cada filtro "restrinja" as opções dos outros, mas sem desabilitá-los.

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

    document.getElementById('clearBtn').addEventListener('click', function() {
        document.getElementById('filterCidade').value = 'all';
        document.getElementById('filterCategoria').value = 'all';
        document.getElementById('filterMedicamento').value = 'all';
        document.getElementById('filterVendedor').value = 'all';

        initializeFilters(); // Repopula todos os filtros com base em allData
        updateDashboard(allData); // Atualiza o dashboard com todos os dados
    });

    // Nova função para atualizar os filtros dependentes
    function updateDependentFilters() {
        let currentFilteredData = allData;

        const selectedCidade = document.getElementById('filterCidade').value;
        const selectedCategoria = document.getElementById('filterCategoria').value;
        const selectedMedicamento = document.getElementById('filterMedicamento').value;
        const selectedVendedor = document.getElementById('filterVendedor').value;

        // Filtra os dados com base nas seleções atuais
        if (selectedCidade !== 'all') {
            currentFilteredData = currentFilteredData.filter(row => row['Cidade'] === selectedCidade);
        }
        if (selectedCategoria !== 'all') {
            currentFilteredData = currentFilteredData.filter(row => row['Categoria'] === selectedCategoria);
        }
        if (selectedMedicamento !== 'all') {
            currentFilteredData = currentFilteredData.filter(row => row['Medicamento'] === selectedMedicamento);
        }
        if (selectedVendedor !== 'all') {
            currentFilteredData = currentFilteredData.filter(row => row['Vendedor'] === selectedVendedor);
        }

        // Repopula os filtros com base nos dados filtrados, mantendo a seleção atual
        const currentCidade = document.getElementById('filterCidade').value;
        const currentCategoria = document.getElementById('filterCategoria').value;
        const currentMedicamento = document.getElementById('filterMedicamento').value;
        const currentVendedor = document.getElementById('filterVendedor').value;

        populateSelect('filterCidade', getUniqueValues(allData, 'Cidade'), 'Todas as Cidades');
        document.getElementById('filterCidade').value = currentCidade;

        populateSelect('filterCategoria', getUniqueValues(currentFilteredData, 'Categoria'), 'Todas as Categorias');
        document.getElementById('filterCategoria').value = currentCategoria;

        populateSelect('filterMedicamento', getUniqueValues(currentFilteredData, 'Medicamento'), 'Todos os Medicamentos');
        document.getElementById('filterMedicamento').value = currentMedicamento;

        populateSelect('filterVendedor', getUniqueValues(currentFilteredData, 'Vendedor'), 'Todos os Vendedores');
        document.getElementById('filterVendedor').value = currentVendedor;
    }
});
