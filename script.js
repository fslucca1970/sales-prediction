let allData = [];
let historicalChart = null;
let projectionChart = null;

// Funções de formatação
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

const formatNumber = (value) => {
    return new Intl.NumberFormat('pt-BR').format(value);
};

// Carregar CSV do GitHub
async function loadCSV() {
    try {
        const response = await fetch('vendas_farmacia.csv');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csv = await response.text();
        parseCSV(csv);
    } catch (error) {
        console.error('Erro ao carregar CSV:', error);
        alert('Erro ao carregar dados. Verifique se o arquivo CSV existe e está no formato correto.');
    }
}

// Parsear CSV
function parseCSV(csv) {
    try {
        const lines = csv.trim().split('\n');

        if (lines.length < 2) {
            console.error('CSV vazio ou inválido');
            alert('CSV vazio ou inválido.');
            return;
        }

        const firstLine = lines[0];
        const separator = firstLine.includes('\t') ? '\t' : ',';

        const headers = lines[0].split(separator).map(h => h.trim().replace(/"/g, ''));
        console.log("Cabeçalhos do CSV lidos:", headers);

        allData = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const values = lines[i].split(separator).map(v => v.trim().replace(/"/g, ''));
            const row = {};

            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });

            // Limpar e converter Preço Unitário para número
            let precoUnitario = parseFloat(row['Preço'].replace('R$', '').replace('.', '').replace(',', '.').trim());
            if (isNaN(precoUnitario)) {
                console.warn(`Preço unitário inválido para a linha ${i + 1}: ${row['Preço']}. Usando 0.`);
                precoUnitario = 0;
            }
            row['Preço Unitário'] = precoUnitario; // Armazena como número

            // Converter Quantidade para número
            let quantidade = parseInt(row['Quantidade']);
            if (isNaN(quantidade) || quantidade <= 0) {
                console.warn(`Quantidade inválida para a linha ${i + 1}: ${row['Quantidade']}. Usando 1.`);
                quantidade = 1;
            }
            row['Quantidade'] = quantidade; // Armazena como número

            // Calcular Preço Total
            row['Preço Total'] = precoUnitario * quantidade;

            allData.push(row);
        }

        console.log("Dados carregados (allData):", allData);
        console.log("Total de registros:", allData.length);
        if (allData.length > 0) {
            console.log("Primeira linha de dados (objeto):", allData[0]);
        }

        if (allData.length === 0) {
            alert('Nenhum dado foi carregado do CSV.');
            return;
        }

        // Inicializa os filtros e o dashboard
        populateFilters(allData); // Popula o primeiro filtro (Cidade)
        updateDashboard(allData);

    } catch (error) {
        console.error('Erro ao fazer parsing do CSV:', error);
        alert('Erro ao fazer parsing do CSV. Verifique o formato dos dados.');
    }
}

// Funções de filtro encadeado
function getUniqueValues(data, field) {
    const values = new Set();
    data.forEach(row => {
        if (row[field]) {
            values.add(row[field]);
        }
    });
    return Array.from(values).sort();
}

function populateDropdown(dropdownId, values, defaultValue) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) {
        console.error(`Dropdown com ID '${dropdownId}' não encontrado.`);
        return;
    }
    dropdown.innerHTML = `<option value="all">${defaultValue}</option>`;
    values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        dropdown.appendChild(option);
    });
    // Habilita o dropdown apenas se houver opções além da padrão
    dropdown.disabled = (values.length === 0); 
    console.log(`Dropdown '${dropdownId}' populado com ${values.length} valores.`);
}

function populateFilters(data) {
    // Popula o filtro de Cidade
    const cidades = getUniqueValues(data, 'Cidade');
    populateDropdown('filterCidade', cidades, 'Todas as Cidades');

    // Reseta e desabilita os outros filtros
    resetDependentFilters('filterCategoria', 'Todas as Categorias');
    resetDependentFilters('filterMedicamento', 'Todos os Medicamentos');
    resetDependentFilters('filterVendedor', 'Todos os Vendedores');
}

function resetDependentFilters(dropdownId, defaultValue) {
    const dropdown = document.getElementById(dropdownId);
    if (dropdown) {
        dropdown.innerHTML = `<option value="all">${defaultValue}</option>`;
        dropdown.disabled = true;
    }
}

function applyFilters() {
    let filteredData = allData;

    const cidade = document.getElementById('filterCidade').value;
    const categoria = document.getElementById('filterCategoria').value;
    const medicamento = document.getElementById('filterMedicamento').value;
    const vendedor = document.getElementById('filterVendedor').value;

    if (cidade !== 'all') {
        filteredData = filteredData.filter(row => row['Cidade'] === cidade);
    }
    if (categoria !== 'all') {
        filteredData = filteredData.filter(row => row['Categoria'] === categoria);
    }
    if (medicamento !== 'all') {
        filteredData = filteredData.filter(row => row['Medicamento'] === medicamento);
    }
    if (vendedor !== 'all') {
        filteredData = filteredData.filter(row => row['Vendedor'] === vendedor);
    }

    updateDashboard(filteredData);
    return filteredData;
}

// Atualizar Dashboard
function updateDashboard(data) {
    updateStats(data);
    renderCharts(data);
    renderTable(data);
    updateLastUpdateDate();
}

// Atualizar Estatísticas
function updateStats(data) {
    const totalSales = data.length;
    const totalRevenue = data.reduce((sum, row) => sum + row['Preço Total'], 0);
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    // Calcular Produto Top
    const productSales = {};
    data.forEach(row => {
        productSales[row['Medicamento']] = (productSales[row['Medicamento']] || 0) + row['Preço Total'];
    });

    let topProduct = '-';
    let maxRevenue = 0;
    for (const product in productSales) {
        if (productSales[product] > maxRevenue) {
            maxRevenue = productSales[product];
            topProduct = product;
        }
    }

    document.getElementById('totalSales').textContent = formatNumber(totalSales);
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('avgTicket').textContent = formatCurrency(avgTicket);
    document.getElementById('topProduct').textContent = topProduct;

    console.log('Estatísticas atualizadas:', { totalSales, totalRevenue, avgTicket, topProduct });
}

// Renderizar Gráficos
function renderCharts(data) {
    const dailySales = {};
    data.forEach(row => {
        const date = row['Data'];
        dailySales[date] = (dailySales[date] || 0) + row['Preço Total'];
    });

    const sortedDates = Object.keys(dailySales).sort();
    const historicalLabels = sortedDates;
    const historicalData = sortedDates.map(date => dailySales[date]);

    // Destruir gráficos existentes antes de criar novos
    if (historicalChart) historicalChart.destroy();
    if (projectionChart) projectionChart.destroy();

    // Gráfico de Histórico de Vendas
    const historicalCtx = document.getElementById('historicalChart').getContext('2d'); // ID corrigido
    historicalChart = new Chart(historicalCtx, {
        type: 'line',
        data: {
            labels: historicalLabels,
            datasets: [{
                label: 'Receita Diária',
                data: historicalData,
                borderColor: 'rgb(0, 72, 72)', // Cor RGB 0 72 72
                backgroundColor: 'rgba(0, 72, 72, 0.2)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        tooltipFormat: 'DD/MM/YYYY',
                        displayFormats: {
                            day: 'DD/MM'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Data'
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

    // Projeção (exemplo simples: média dos últimos 7 dias)
    const last7DaysRevenue = historicalData.slice(-7);
    const avgLast7Days = last7DaysRevenue.length > 0 ? last7DaysRevenue.reduce((a, b) => a + b, 0) / last7DaysRevenue.length : 0;

    const projectionLabels = [];
    const projectionData = [];
    let lastDate = new Date(sortedDates[sortedDates.length - 1]);

    for (let i = 1; i <= 7; i++) {
        lastDate.setDate(lastDate.getDate() + 1);
        projectionLabels.push(lastDate.toISOString().split('T')[0]);
        projectionData.push(avgLast7Days * (1 + (Math.random() - 0.5) * 0.1)); // Variação de +/- 5%
    }

    const projectionCtx = document.getElementById('projectionChart').getContext('2d');
    projectionChart = new Chart(projectionCtx, {
        type: 'line',
        data: {
            labels: projectionLabels,
            datasets: [{
                label: 'Receita Projetada',
                data: projectionData,
                borderColor: 'rgb(0, 72, 72)', // Cor RGB 0 72 72
                backgroundColor: 'rgba(0, 72, 72, 0.2)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        tooltipFormat: 'DD/MM/YYYY',
                        displayFormats: {
                            day: 'DD/MM'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Data'
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
    console.log('Gráficos atualizados.');
}

// Renderizar Tabela
function renderTable(data) {
    const tableBody = document.getElementById('salesTableBody');
    if (!tableBody) {
        console.error("Elemento 'salesTableBody' não encontrado.");
        return;
    }
    tableBody.innerHTML = ''; // Limpa a tabela existente

    // Limita a 500 registros ou o total de dados, o que for menor
    const recordsToShow = Math.min(data.length, 500); 
    const sortedData = data.sort((a, b) => new Date(b['Data']) - new Date(a['Data'])); // Ordena por data decrescente

    for (let i = 0; i < recordsToShow; i++) {
        const rowData = sortedData[i];
        const row = tableBody.insertRow();

        row.insertCell().textContent = rowData['Data'];
        row.insertCell().textContent = rowData['Medicamento'];
        row.insertCell().textContent = rowData['Categoria'];
        row.insertCell().textContent = formatNumber(rowData['Quantidade']);
        row.insertCell().textContent = formatCurrency(rowData['Preço Unitário']);
        row.insertCell().textContent = formatCurrency(rowData['Preço Total']);
        row.insertCell().textContent = rowData['Cidade'];
        row.insertCell().textContent = rowData['Vendedor'];
    }
    console.log(`Tabela 'Detalhamento Diário' preenchida com ${recordsToShow} registros.`);
}

// Atualizar data da última atualização
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

// Inicialização - TODOS os Event Listeners dentro do DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado. Iniciando carregamento do CSV...');

    loadCSV(); // Inicia o carregamento do CSV

    // Event Listeners para os filtros encadeados
    const filterCidadeEl = document.getElementById('filterCidade');
    const filterCategoriaEl = document.getElementById('filterCategoria');
    const filterMedicamentoEl = document.getElementById('filterMedicamento');
    const filterVendedorEl = document.getElementById('filterVendedor');

    if (filterCidadeEl) {
        filterCidadeEl.addEventListener('change', () => {
            const selectedCidade = filterCidadeEl.value;
            let currentFilteredData = allData;

            if (selectedCidade !== 'all') {
                currentFilteredData = allData.filter(row => row['Cidade'] === selectedCidade);
            }

            // Popula Categoria com base na Cidade selecionada
            const categorias = getUniqueValues(currentFilteredData, 'Categoria');
            populateDropdown('filterCategoria', categorias, 'Todas as Categorias');

            // Reseta e desabilita os filtros seguintes
            resetDependentFilters('filterMedicamento', 'Todos os Medicamentos');
            resetDependentFilters('filterVendedor', 'Todos os Vendedores');

            applyFilters(); // Aplica o filtro atual e atualiza o dashboard
        });
    }

    if (filterCategoriaEl) {
        filterCategoriaEl.addEventListener('change', () => {
            const selectedCidade = filterCidadeEl.value;
            const selectedCategoria = filterCategoriaEl.value;
            let currentFilteredData = allData;

            if (selectedCidade !== 'all') {
                currentFilteredData = currentFilteredData.filter(row => row['Cidade'] === selectedCidade);
            }
            if (selectedCategoria !== 'all') {
                currentFilteredData = currentFilteredData.filter(row => row['Categoria'] === selectedCategoria);
            }

            // Popula Medicamento com base na Cidade e Categoria selecionadas
            const medicamentos = getUniqueValues(currentFilteredData, 'Medicamento');
            populateDropdown('filterMedicamento', medicamentos, 'Todos os Medicamentos');

            // Reseta e desabilita o filtro de Vendedor
            resetDependentFilters('filterVendedor', 'Todos os Vendedores');

            applyFilters(); // Aplica o filtro atual e atualiza o dashboard
        });
    }

    if (filterMedicamentoEl) {
        filterMedicamentoEl.addEventListener('change', () => {
            const selectedCidade = filterCidadeEl.value;
            const selectedCategoria = filterCategoriaEl.value;
            const selectedMedicamento = filterMedicamentoEl.value;
            let currentFilteredData = allData;

            if (selectedCidade !== 'all') {
                currentFilteredData = currentFilteredData.filter(row => row['Cidade'] === selectedCidade);
            }
            if (selectedCategoria !== 'all') {
                currentFilteredData = currentFilteredData.filter(row => row['Categoria'] === selectedCategoria);
            }
            if (selectedMedicamento !== 'all') {
                currentFilteredData = currentFilteredData.filter(row => row['Medicamento'] === selectedMedicamento);
            }

            // Popula Vendedor com base na Cidade, Categoria e Medicamento selecionados
            const vendedores = getUniqueValues(currentFilteredData, 'Vendedor');
            populateDropdown('filterVendedor', vendedores, 'Todos os Vendedores');

            applyFilters(); // Aplica o filtro atual e atualiza o dashboard
        });
    }

    if (filterVendedorEl) {
        filterVendedorEl.addEventListener('change', () => {
            applyFilters(); // Aplica o filtro atual e atualiza o dashboard
        });
    }

    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            // Reseta todos os dropdowns para 'all' e desabilita os dependentes
            filterCidadeEl.value = 'all';
            resetDependentFilters('filterCategoria', 'Todas as Categorias');
            resetDependentFilters('filterMedicamento', 'Todos os Medicamentos');
            resetDependentFilters('filterVendedor', 'Todos os Vendedores');

            // Dispara o evento change no filtro de Cidade para repopular os dependentes
            filterCidadeEl.dispatchEvent(new Event('change')); 
            // A chamada a applyFilters() dentro do change de filterCidadeEl já cuidará do updateDashboard(allData)
        });
    }
});
