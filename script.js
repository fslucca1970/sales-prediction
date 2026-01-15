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
        alert('Arquivo CSV vazio ou inválido.');
        return;
    }

    // Detecta o separador (tabulação ou vírgula)
    const firstLine = lines[0];
    const separator = firstLine.includes('\t') ? '\t' : ',';

    const headers = lines[0].split(separator).map(h => h.trim().replace(/"/g, ''));

    // Limpa allData antes de preencher
    allData = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue; // Pula linhas vazias

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

    // Inicializa o dropdown apenas se o elemento existir
    const filterTypeElement = document.getElementById('filterType');
    if (filterTypeElement) {
        populateFilterDropdown(filterTypeElement.value);
    }
}

// Atualizar dashboard
function updateDashboard(data) {
    if (!data || data.length === 0) {
        console.warn('updateDashboard chamado com dados vazios');
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
        if (!row.preco) return sum;

        // Remove "R$", "R$ ", espaços e substitui vírgula por ponto
        const cleanPrice = row.preco.replace(/R\$\s*/g, '').replace(/\s/g, '').replace(',', '.');
        const price = parseFloat(cleanPrice);

        return sum + (isNaN(price) ? 0 : price);
    }, 0);

    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    const products = {};
    data.forEach(row => {
        if (row.nome_produto) {
            products[row.nome_produto] = (products[row.nome_produto] || 0) + 1;
        }
    });

    const topProduct = Object.keys(products).length > 0 
        ? Object.keys(products).reduce((a, b) => products[a] > products[b] ? a : b)
        : '-';

    // Atualiza os elementos HTML
    const totalSalesEl = document.getElementById('totalSales');
    const totalRevenueEl = document.getElementById('totalRevenue');
    const avgTicketEl = document.getElementById('avgTicket');
    const topProductEl = document.getElementById('topProduct');

    if (totalSalesEl) totalSalesEl.textContent = totalSales;
    if (totalRevenueEl) totalRevenueEl.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue);
    if (avgTicketEl) avgTicketEl.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(avgTicket);
    if (topProductEl) topProductEl.textContent = topProduct;
}

// Renderizar tabela
function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.data_venda || '-'}</td>
            <td>${row.nome_produto || '-'}</td>
            <td>${row.categoria || '-'}</td>
            <td>${row.unidade || '-'}</td>
            <td>${row.nome_vendedor || '-'}</td>
            <td>${row.preco || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Renderizar gráficos
function renderCharts(data) {
    const byDate = {};

    data.forEach(row => {
        if (!row.data_venda) return;

        if (!byDate[row.data_venda]) {
            byDate[row.data_venda] = { count: 0, revenue: 0 };
        }

        byDate[row.data_venda].count++;

        if (row.preco) {
            const cleanPrice = row.preco.replace(/R\$\s*/g, '').replace(/\s/g, '').replace(',', '.');
            const price = parseFloat(cleanPrice);
            byDate[row.data_venda].revenue += isNaN(price) ? 0 : price;
        }
    });

    const dates = Object.keys(byDate).sort();
    const counts = dates.map(d => byDate[d].count);

    // Gráfico Histórico
    const ctx1 = document.getElementById('historicalChart');
    if (ctx1) {
        if (historicalChart) historicalChart.destroy();

        historicalChart = new Chart(ctx1.getContext('2d'), {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Vendas por Dia',
                    data: counts,
                    borderColor: 'rgb(0, 72, 18)',
                    backgroundColor: 'rgba(0, 72, 18, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: true,
                plugins: { legend: { position: 'top' } } 
            }
        });
    }

    // Gráfico de Projeção
    const avgSales = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    const projectionDays = 7;
    const projectionLabels = [];
    const projectionData = [];

    const lastDate = dates.length > 0 ? new Date(dates[dates.length - 1]) : new Date();

    for (let i = 1; i <= projectionDays; i++) {
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + i);
        projectionLabels.push(nextDate.toLocaleDateString('pt-BR'));
        projectionData.push(Math.round(avgSales * (0.95 + Math.random() * 0.1)));
    }

    const ctx2 = document.getElementById('projectionChart');
    if (ctx2) {
        if (projectionChart) projectionChart.destroy();

        projectionChart = new Chart(ctx2.getContext('2d'), {
            type: 'bar',
            data: {
                labels: projectionLabels,
                datasets: [{
                    label: 'Vendas Projetadas',
                    data: projectionData,
                    backgroundColor: 'rgba(0, 100, 30, 0.7)',
                    borderColor: 'rgb(0, 72, 18)',
                    borderWidth: 1
                }]
            },
            options: { 
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { position: 'top' } } 
            }
        });
    }
}

// Preencher dropdown dinâmico
function populateFilterDropdown(filterType) {
    const dropdown = document.getElementById('filterValue');

    // Verifica se o elemento existe antes de tentar acessá-lo
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
        'medicamento': 'nome_produto',
        'cidade': 'unidade',
        'categoria': 'categoria',
        'vendedor': 'nome_vendedor'
    };

    const field = fieldMap[filterType];

    if (!field || allData.length === 0) {
        console.warn('Campo não encontrado ou allData vazio');
        return;
    }

    const uniqueValues = [...new Set(
        allData
            .map(row => row[field])
            .filter(value => value && value.trim() !== '')
    )].sort();

    console.log(`Valores únicos para ${filterType}:`, uniqueValues);

    uniqueValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        dropdown.appendChild(option);
    });
}

// Event Listeners
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
                'medicamento': 'nome_produto',
                'cidade': 'unidade',
                'categoria': 'categoria',
                'vendedor': 'nome_vendedor'
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
