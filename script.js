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
    const lines = csv.trim().split('\n');

    if (lines.length < 2) {
        console.error('CSV vazio ou inválido');
        return;
    }

    // Detecta o separador (tabulação ou vírgula)
    const firstLine = lines[0];
    const separator = firstLine.includes('\t') ? '\t' : ',';

    const headers = lines[0].split(separator).map(h => h.trim().replace(/"/g, ''));

    allData = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(separator).map(v => v.trim().replace(/"/g, ''));
        const row = {};

        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });

        allData.push(row);
    }

    console.log("Dados carregados (allData):", allData);
    console.log("Total de registros:", allData.length);

    if (allData.length === 0) {
        alert('Nenhum dado foi carregado do CSV.');
        return;
    }

    updateDashboard(allData);

    // Inicializa o dropdown
    const filterTypeElement = document.getElementById('filterType');
    if (filterTypeElement) {
        populateFilterDropdown(filterTypeElement.value);
    }
}

// Atualizar dashboard
function updateDashboard(data) {
    if (!data || data.length === 0) {
        console.warn('updateDashboard chamado com dados vazios');
        // Limpa gráficos e estatísticas se não houver dados
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

    const totalRevenue = data.reduce((sum, row) => {
        if (!row.Preço) return sum; // Usando 'Preço'

        // Remove "R$", espaços e substitui vírgula por ponto
        const priceStr = row.Preço.toString().replace(/R\$\s*/g, '').replace(/\s/g, '').replace(',', '.');
        const price = parseFloat(priceStr);

        return sum + (isNaN(price) ? 0 : price);
    }, 0);

    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    const products = {};
    data.forEach(row => {
        if (row.Medicamento) { // Usando 'Medicamento'
            products[row.Medicamento] = (products[row.Medicamento] || 0) + 1;
        }
    });

    const topProduct = Object.keys(products).length > 0 
        ? Object.keys(products).reduce((a, b) => products[a] > products[b] ? a : b)
        : '-';

    document.getElementById('totalSales').textContent = totalSales;
    document.getElementById('totalRevenue').textContent = 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue);
    document.getElementById('avgTicket').textContent = 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(avgTicket);
    document.getElementById('topProduct').textContent = topProduct;
}

// Renderizar tabela
function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Limita a 50 linhas para performance
    const displayData = data.slice(0, 50);

    displayData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.Data || '-'}</td>         <!-- CORRIGIDO: row.Data -->
            <td>${row.Medicamento || '-'}</td>  <!-- CORRIGIDO: row.Medicamento -->
            <td>${row.Categoria || '-'}</td>
            <td>${row.Cidade || '-'}</td>       <!-- CORRIGIDO: row.Cidade -->
            <td>${row.Vendedor || '-'}</td>     <!-- CORRIGIDO: row.Vendedor -->
            <td>${row.Preço || '-'}</td>        <!-- CORRIGIDO: row.Preço -->
        `;
        tbody.appendChild(tr);
    });
}

// Renderizar gráficos
function renderCharts(data) {
    // Garante que os gráficos sejam destruídos mesmo se não houver dados para renderizar
    if (historicalChart) historicalChart.destroy();
    if (projectionChart) projectionChart.destroy();

    if (data.length === 0) {
        // Se não há dados, os gráficos ficam vazios ou com uma mensagem
        return;
    }

    // Agrupa vendas por Data (CORRIGIDO AQUI)
    const salesByDate = {};
    data.forEach(row => {
        const date = row.Data; // Usando 'Data'
        if (date) {
            salesByDate[date] = (salesByDate[date] || 0) + 1;
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
                    label: 'Vendas Diárias',
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
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1 // Garante que os ticks sejam inteiros
                        }
                    }
                }
            }
        });
    }

    // Gráfico de projeção (média móvel simples dos últimos 7 dias)
    const projectionCtx = document.getElementById('projectionChart');
    if (projectionCtx && salesValues.length > 0) {
        // Calcula média dos últimos 7 dias (ou todos se menos de 7)
        const last7Days = salesValues.slice(-7);
        const avgSales = last7Days.reduce((a, b) => a + b, 0) / last7Days.length;

        // Projeção para os próximos 7 dias
        const projectionLabels = [];
        const projectionValues = [];

        const lastDate = new Date(sortedDates[sortedDates.length - 1]);

        for (let i = 1; i <= 7; i++) {
            const nextDate = new Date(lastDate);
            nextDate.setDate(lastDate.getDate() + i);
            projectionLabels.push(nextDate.toLocaleDateString('pt-BR'));
            projectionValues.push(Math.round(avgSales));
        }

        projectionChart = new Chart(projectionCtx, {
            type: 'bar',
            data: {
                labels: projectionLabels,
                datasets: [{
                    label: 'Projeção de Vendas',
                    data: projectionValues,
                    backgroundColor: 'rgba(0, 100, 30, 0.7)',
                    borderColor: 'rgb(0, 72, 18)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1 // Garante que os ticks sejam inteiros
                        }
                    }
                }
            }
        });
    }
}

// Preencher dropdown dinâmico
function populateFilterDropdown(filterType) {
    const dropdown = document.getElementById('filterValue');
    if (!dropdown) {
        console.error('Elemento filterValue não encontrado');
        return;
    }

    dropdown.innerHTML = '<option value="">Escolha uma opção...</option>';

    if (filterType === 'all') {
        dropdown.classList.add('hidden');
        return;
    }

    dropdown.classList.remove('hidden');

    const fieldMap = {
        'medicamento': 'Medicamento', // CORRIGIDO: 'Medicamento'
        'cidade': 'Cidade',           // CORRIGIDO: 'Cidade'
        'categoria': 'Categoria',
        'vendedor': 'Vendedor'        // CORRIGIDO: 'Vendedor'
    };

    const field = fieldMap[filterType];

    if (!field || allData.length === 0) {
        return;
    }

    const uniqueValues = [...new Set(
        allData
            .map(row => row[field])
            .filter(value => value && value.trim() !== '')
    )].sort();

    uniqueValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        dropdown.appendChild(option);
    });
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
    // Carrega o CSV
    loadCSV();

    // Event listener para mudança no tipo de filtro
    const filterTypeEl = document.getElementById('filterType');
    if (filterTypeEl) {
        filterTypeEl.addEventListener('change', (e) => {
            populateFilterDropdown(e.target.value);
        });
    }

    // Event listener para botão de filtrar
    const filterBtn = document.getElementById('filterBtn');
    if (filterBtn) {
        filterBtn.addEventListener('click', () => {
            const filterType = document.getElementById('filterType').value;
            const filterValue = document.getElementById('filterValue').value;

            if (filterType === 'all' || !filterValue) {
                updateDashboard(allData);
                return;
            }

            const fieldMap = {
                'medicamento': 'Medicamento', // CORRIGIDO: 'Medicamento'
                'cidade': 'Cidade',           // CORRIGIDO: 'Cidade'
                'categoria': 'Categoria',
                'vendedor': 'Vendedor'        // CORRIGIDO: 'Vendedor'
            };

            const field = fieldMap[filterType];
            const filtered = allData.filter(row => row[field] === filterValue);

            console.log(`Filtrado por ${filterType} = ${filterValue}:`, filtered.length, 'registros');

            updateDashboard(filtered);
        });
    }

    // Event listener para botão de limpar
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
