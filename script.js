let allData = [];
let historicalChart = null;
let projectionChart = null;

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

        // Detecta o separador (tabulação ou vírgula)
        const firstLine = lines[0];
        const separator = firstLine.includes('\t') ? '\t' : ',';

        const headers = lines[0].split(separator).map(h => h.trim().replace(/"/g, ''));
        console.log("Cabeçalhos do CSV lidos:", headers); // Log para verificar os cabeçalhos lidos

        allData = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const values = lines[i].split(separator).map(v => v.trim().replace(/"/g, ''));
            const row = {};

            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });

            // --- NOVO: Calcular Preço Total e garantir tipos corretos ---
            const precoUnitarioStr = row.Preço ? row.Preço.replace(/R\$\s*/g, '').replace(/\s/g, '').replace(',', '.') : '0';
            const precoUnitario = parseFloat(precoUnitarioStr);
            const quantidade = parseInt(row.Quantidade || '1'); // Assume 1 se Quantidade não estiver presente ou for inválida

            row.PreçoUnitario = precoUnitario; // Armazena o preço unitário como número
            row.Quantidade = quantidade; // Armazena a quantidade como número
            row['Preço Total'] = precoUnitario * quantidade; // Calcula e armazena o preço total

            allData.push(row);
        }

        console.log("Dados carregados (allData):", allData);
        console.log("Total de registros:", allData.length);
        if (allData.length > 0) {
            console.log("Primeira linha de dados (objeto):", allData[0]); // Log para verificar o objeto da primeira linha
        }

        if (allData.length === 0) {
            alert('Nenhum dado foi carregado do CSV.');
            return;
        }

        // Atualiza o dashboard com os dados carregados
        updateDashboard(allData);

        // Inicializa o dropdown após um pequeno delay para garantir que o DOM está pronto
        setTimeout(() => {
            const filterTypeElement = document.getElementById('filterType');
            if (filterTypeElement) {
                populateFilterDropdown(filterTypeElement.value);
            }
        }, 100);

    } catch (error) {
        console.error('Erro ao fazer parsing do CSV:', error);
        alert('Erro ao fazer parsing do CSV: ' + error.message);
    }
}

// Atualizar dashboard
function updateDashboard(data) {
    // Se não há dados, limpa gráficos e estatísticas
    if (!data || data.length === 0) {
        console.warn('updateDashboard chamado com dados vazios');
        updateStats([]);
        renderTable([]);
        renderCharts([]);
        updateCurrentDate();
        return;
    }

    updateStats(data);
    renderTable(data);
    renderCharts(data);
    updateCurrentDate();
}

// Atualizar estatísticas
function updateStats(data) {
    const totalSales = data.length;

    // --- ALTERADO: Usar 'Preço Total' para a receita ---
    const totalRevenue = data.reduce((sum, row) => {
        return sum + (row['Preço Total'] || 0);
    }, 0);

    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    // Produto mais vendido (por quantidade)
    const productQuantities = data.reduce((acc, row) => {
        const productName = row.Medicamento;
        const quantity = row.Quantidade || 0;
        acc[productName] = (acc[productName] || 0) + quantity;
        return acc;
    }, {});

    let topProduct = 'N/A';
    let maxQuantity = 0;
    for (const product in productQuantities) {
        if (productQuantities[product] > maxQuantity) {
            maxQuantity = productQuantities[product];
            topProduct = product;
        }
    }

    document.getElementById('totalSales').textContent = totalSales;
    document.getElementById('totalRevenue').textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue);
    document.getElementById('averageTicket').textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(averageTicket);
    document.getElementById('topProduct').textContent = topProduct;
}

// Renderizar tabela
function renderTable(data) {
    const tableBody = document.getElementById('salesTableBody');
    if (!tableBody) {
        console.error("Elemento 'salesTableBody' não encontrado.");
        return;
    }
    tableBody.innerHTML = ''; // Limpa a tabela antes de preencher

    // Garante que a tabela seja visível
    const tableContainer = document.getElementById('dailyDetailTable');
    if (tableContainer) {
        tableContainer.classList.remove('hidden');
    }

    const recordsToShow = Math.min(data.length, 50); // Limita a 50 registros ou menos se houver menos dados
    for (let i = 0; i < recordsToShow; i++) {
        const row = data[i];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.Data || ''}</td>
            <td>${row.Medicamento || ''}</td>
            <td>${row.Categoria || ''}</td>
            <td>${row.Quantidade || 0}</td> <!-- NOVO: Coluna Quantidade -->
            <td>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.PreçoUnitario || 0)}</td> <!-- Preço Unitário -->
            <td>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row['Preço Total'] || 0)}</td> <!-- NOVO: Preço Total -->
            <td>${row.Cidade || ''}</td>
            <td>${row.Vendedor || ''}</td>
        `;
        tableBody.appendChild(tr);
    }
    console.log(`Tabela 'Detalhamento Diário' preenchida com ${recordsToShow} registros.`);
}

// Renderizar gráficos
function renderCharts(data) {
    const salesByDate = data.reduce((acc, row) => {
        const date = row.Data;
        // --- ALTERADO: Usar 'Preço Total' para o valor da venda ---
        const value = row['Preço Total'] || 0;
        acc[date] = (acc[date] || 0) + value;
        return acc;
    }, {});

    const sortedDates = Object.keys(salesByDate).sort();
    const chartLabels = sortedDates;
    const chartData = sortedDates.map(date => salesByDate[date]);

    // Histórico de Vendas
    const historicalCtx = document.getElementById('historicalSalesChart').getContext('2d');
    if (historicalChart) {
        historicalChart.destroy();
    }
    historicalChart = new Chart(historicalCtx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Vendas Diárias (R$)',
                data: chartData,
                borderColor: 'rgb(0, 72, 72)', // Cor da linha
                backgroundColor: 'rgba(0, 72, 72, 0.2)', // Cor da área abaixo da linha
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
                                label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });

    // Projeção de Vendas (Exemplo simples: média dos últimos 7 dias)
    const last7DaysData = chartData.slice(-7);
    const averageLast7Days = last7DaysData.length > 0 ? last7DaysData.reduce((a, b) => a + b, 0) / last7DaysData.length : 0;

    const projectionLabels = [];
    const projectionValues = [];
    let currentDate = new Date(sortedDates[sortedDates.length - 1]);
    for (let i = 1; i <= 7; i++) {
        currentDate.setDate(currentDate.getDate() + 1);
        projectionLabels.push(currentDate.toISOString().split('T')[0]);
        projectionValues.push(averageLast7Days); // Projeção simples: mantém a média
    }

    const projectionCtx = document.getElementById('projectionChart').getContext('2d');
    if (projectionChart) {
        projectionChart.destroy();
    }
    projectionChart = new Chart(projectionCtx, {
        type: 'line',
        data: {
            labels: projectionLabels,
            datasets: [{
                label: 'Projeção Diária (R$)',
                data: projectionValues,
                borderColor: 'rgb(0, 72, 72)', // Cor da linha
                backgroundColor: 'rgba(0, 72, 72, 0.2)', // Cor da área abaixo da linha
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
                                label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

// Atualizar data atual no dashboard
function updateCurrentDate() {
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = today.toLocaleDateString('pt-BR', options);
}

// Popular dropdown de filtro
function populateFilterDropdown(filterType) {
    const filterValueDropdown = document.getElementById('filterValue');
    if (!filterValueDropdown) {
        console.error("Elemento 'filterValue' não encontrado.");
        return;
    }
    filterValueDropdown.innerHTML = '<option value="">Selecione...</option>'; // Opção padrão
    filterValueDropdown.classList.remove('hidden'); // Garante que o dropdown esteja visível

    let uniqueValues = new Set();
    let field = '';

    switch (filterType) {
        case 'all':
            filterValueDropdown.classList.add('hidden'); // Esconde se for 'Todos'
            updateDashboard(allData); // Reseta o dashboard
            return;
        case 'medicamento':
            field = 'Medicamento';
            break;
        case 'cidade':
            field = 'Cidade';
            break;
        case 'categoria':
            field = 'Categoria';
            break;
        case 'vendedor':
            field = 'Vendedor';
            break;
        default:
            console.warn('Tipo de filtro desconhecido:', filterType);
            filterValueDropdown.classList.add('hidden');
            return;
    }

    allData.forEach(row => {
        if (row[field]) {
            uniqueValues.add(row[field]);
        }
    });

    Array.from(uniqueValues).sort().forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        filterValueDropdown.appendChild(option);
    });
    console.log(`Dropdown de filtro '${filterType}' populado com ${uniqueValues.size} valores únicos.`);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado. Iniciando carregamento do CSV...');
    loadCSV();

    const filterTypeElement = document.getElementById('filterType');
    if (filterTypeElement) {
        filterTypeElement.addEventListener('change', (event) => {
            populateFilterDropdown(event.target.value);
        });
    }

    const filterValueElement = document.getElementById('filterValue');
    if (filterValueElement) {
        filterValueElement.addEventListener('change', (event) => {
            const filterType = document.getElementById('filterType').value;
            const filterValue = event.target.value;

            if (!filterValue) { // Se "Selecione..." for escolhido, volta para todos os dados
                updateDashboard(allData);
                return;
            }

            let field = '';
            switch (filterType) {
                case 'medicamento':
                    field = 'Medicamento';
                    break;
                case 'cidade':
                    field = 'Cidade';
                    break;
                case 'categoria':
                    field = 'Categoria';
                    break;
                case 'vendedor':
                    field = 'Vendedor';
                    break;
                default:
                    console.warn('Tipo de filtro desconhecido para aplicação:', filterType);
                    return;
            }

            const filtered = allData.filter(row => row[field] === filterValue);

            console.log(`Filtrado por ${filterType} = ${filterValue}:`, filtered.length, 'registros');

            updateDashboard(filtered);
        });
    }

    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const filterTypeEl = document.getElementById('filterType');
            const filterValueEl = document.getElementById('filterValue');

            if (filterTypeEl) filterTypeEl.value = 'all';
            if (filterValueEl) filterValueEl.classList.add('hidden');

            updateDashboard(allData);
        });
    }
});
