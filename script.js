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
        console.log("Cabeçalhos do CSV lidos:", headers);

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
            console.log("Primeira linha de dados (objeto):", allData[0]);
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
    document.getElementById('avgTicket').textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(averageTicket);
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

    const recordsToShow = Math.min(data.length, 50); // Limita a 50 registros ou menos se houver menos dados
    for (let i = 0; i < recordsToShow; i++) {
        const row = data[i];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.Data || ''}</td>
            <td>${row.Medicamento || ''}</td>
            <td>${row.Categoria || ''}</td>
            <td>${row.Quantidade || 0}</td>
            <td>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.PreçoUnitario || 0)}</td>
            <td>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row['Preço Total'] || 0)}</td>
            <td>${row.Cidade || ''}</td>
            <td>${row.Vendedor || ''}</td>
        `;
        tableBody.appendChild(tr);
    }
    console.log(`Tabela 'Detalhamento Diário' preenchida com ${recordsToShow} registros.`);
    console.log("Conteúdo do tbody após preenchimento:", tableBody.innerHTML);
}

// Renderizar gráficos
function renderCharts(data) {
    // Destrói gráficos existentes para evitar sobreposição
    if (historicalChart) {
        historicalChart.destroy();
        historicalChart = null;
    }
    if (projectionChart) {
        projectionChart.destroy();
        projectionChart = null;
    }

    if (data.length === 0) {
        // Se não há dados, os gráficos ficam vazios
        return;
    }

    // Agrupa vendas por Data
    const salesByDate = {};
    data.forEach(row => {
        const date = row.Data;
        // --- ALTERADO: Usar 'Preço Total' para o valor da venda ---
        const value = row['Preço Total'] || 0;
        if (date) {
            salesByDate[date] = (salesByDate[date] || 0) + value;
        }
    });

    // Ordena as datas
    const sortedDates = Object.keys(salesByDate).sort();
    const salesValues = sortedDates.map(date => salesByDate[date]);

    // Gráfico de histórico
    const historicalCtx = document.getElementById('historicalChart');
    if (historicalCtx) {
        historicalChart = new Chart(historicalCtx, {
            type: 'line',
            data: {
                labels: sortedDates,
                datasets: [{
                    label: 'Vendas Diárias (R$)',
                    data: salesValues,
                    borderColor: 'rgb(0, 72, 18)',
                    backgroundColor: 'rgba(0, 72, 18, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { position: 'top' } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { 
                            stepSize: 1,
                            callback: function(value) {
                                return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
                            }
                        }
                    }
                },
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
        });
    }

    // Gráfico de projeção (média móvel simples dos últimos 7 dias)
    const projectionCtx = document.getElementById('projectionChart');
    if (projectionCtx && salesValues.length > 0) {
        const projectionLabels = [];
        const projectionData = [];
        const numDays = salesValues.length;

        // Calcula a média móvel dos últimos 7 dias para projeção
        for (let i = 0; i < numDays; i++) {
            if (i >= 6) {
                const last7Days = salesValues.slice(i - 6, i + 1);
                const sum = last7Days.reduce((a, b) => a + b, 0);
                projectionData.push(sum / last7Days.length);
                projectionLabels.push(sortedDates[i]);
            } else {
                projectionData.push(salesValues[i]); 
                projectionLabels.push(sortedDates[i]);
            }
        }

        // Adiciona 3 dias de projeção futura baseada na última média
        if (projectionData.length > 0) {
            const lastAvg = projectionData[projectionData.length - 1];
            const lastDate = new Date(sortedDates[sortedDates.length - 1]);
            for (let i = 1; i <= 3; i++) {
                const nextDate = new Date(lastDate);
                nextDate.setDate(lastDate.getDate() + i);
                projectionLabels.push(nextDate.toISOString().split('T')[0]);
                projectionData.push(lastAvg);
            }
        }

        projectionChart = new Chart(projectionCtx, {
            type: 'bar',
            data: {
                labels: projectionLabels,
                datasets: [{
                    label: 'Projeção de Vendas (R$)',
                    data: projectionData,
                    backgroundColor: 'rgba(0, 72, 18, 0.6)',
                    borderColor: 'rgb(0, 72, 18)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { position: 'top' } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { 
                            stepSize: 1,
                            callback: function(value) {
                                return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
                            }
                        }
                    }
                },
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
        });
    }
}

// Preencher dropdown de filtro dinamicamente
function populateFilterDropdown(filterType) {
    const dropdown = document.getElementById('filterValue');
    if (!dropdown) {
        console.error('Elemento filterValue não encontrado.');
        return;
    }

    dropdown.innerHTML = '<option value="">Escolha uma opção...</option>';

    if (filterType === 'all') {
        dropdown.classList.add('hidden');
        console.log("Dropdown 'Selecione:' está oculto (filterType é 'all').");
        return;
    }

    dropdown.classList.remove('hidden');
    console.log("Dropdown 'Selecione:' está visível (classe 'hidden' removida).");

    let fieldName = '';

    switch (filterType) {
        case 'medicamento':
            fieldName = 'Medicamento';
            break;
        case 'cidade':
            fieldName = 'Cidade';
            break;
        case 'categoria':
            fieldName = 'Categoria';
            break;
        case 'vendedor':
            fieldName = 'Vendedor';
            break;
        default:
            dropdown.classList.add('hidden');
            console.warn('Tipo de filtro desconhecido:', filterType);
            return;
    }

    const uniqueValues = new Set();
    allData.forEach(row => {
        if (row[fieldName]) {
            uniqueValues.add(row[fieldName]);
        }
    });

    const sortedValues = Array.from(uniqueValues).sort();
    sortedValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        dropdown.appendChild(option);
    });
    console.log(`Dropdown '${filterType}' preenchido com ${sortedValues.length} opções.`);
}

// Atualizar data
function updateCurrentDate() {
    const currentDateEl = document.getElementById('currentDate');
    if (currentDateEl) {
        const now = new Date();
        currentDateEl.textContent = now.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    }
}

// Inicialização - TODOS os Event Listeners dentro do DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado. Iniciando carregamento do CSV...');

    loadCSV(); // Inicia o carregamento do CSV

    const filterTypeEl = document.getElementById('filterType');
    if (filterTypeEl) {
        filterTypeEl.addEventListener('change', (e) => {
            console.log('Filtro alterado para:', e.target.value);
            populateFilterDropdown(e.target.value);
        });
    }

    const filterBtn = document.getElementById('filterBtn');
    if (filterBtn) {
        filterBtn.addEventListener('click', () => {
            const filterType = document.getElementById('filterType').value;
            const filterValue = document.getElementById('filterValue').value;

            console.log('Filtro clicado:', filterType, filterValue);

            if (filterType === 'all' || !filterValue) {
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
                    console.warn('Tipo de filtro desconhecido:', filterType);
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
