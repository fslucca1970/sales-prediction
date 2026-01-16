     let salesData = [];
    let salesHistoryChart;
    let salesProjectionChart;

    // Elementos do DOM
    const filterCidade = document.getElementById('filterCidade');
    const filterCategoria = document.getElementById('filterCategoria');
    const filterMedicamento = document.getElementById('filterMedicamento');
    const filterVendedor = document.getElementById('filterVendedor');
    const filterPeriodo = document.getElementById('filterPeriodo');
    const projectionMetric = document.getElementById('projectionMetric'); // NOVO: Seletor de métrica da projeção

    // Funções de formatação
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    // Função para parsear o CSV
    async function parseCSV() {
        const response = await fetch('vendas_farmacia.csv');
        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const headers = lines[0].split(',').map(header => header.trim());
        const parsedData = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            let row = {};
            let isValidRow = true;

            if (values.length !== headers.length) {
                console.warn(`Linha ${i + 1}: Ignorando linha malformada. Esperado ${headers.length} colunas, encontrado ${values.length}.`);
                isValidRow = false;
            } else {
                for (let j = 0; j < headers.length; j++) {
                    row[headers[j]] = values[j].trim();
                }

                // Validação e conversão de tipos
                row['Data'] = new Date(row['Data']);
                if (isNaN(row['Data'].getTime())) {
                    console.warn(`Linha ${i + 1}: Data inválida "${row['Data']}". Ignorando linha.`);
                    isValidRow = false;
                }

                const quantidade = parseInt(row['Quantidade']);
                if (isNaN(quantidade)) {
                    console.warn(`Linha ${i + 1}: Quantidade inválida "${row['Quantidade']}". Usando 0.`);
                    isValidRow = false;
                }
                row['Quantidade'] = quantidade;

                // Usar 'Preço' do CSV para Preço Unitário
                let precoUnitarioRaw = String(row['Preço'] || '0').replace('R$', '').trim();
                // Correção cirúrgica: Não remover o ponto se ele for o separador decimal.
                // Se o CSV usa PONTO como separador decimal (ex: 8.50), a linha que removia o ponto (replace(/\./g, '')) deve ser removida.
                // Se o CSV usasse VÍRGULA como separador decimal (ex: 8,50), faríamos: precoUnitarioRaw = precoUnitarioRaw.replace(',', '.');
                const precoUnitario = parseFloat(precoUnitarioRaw);
                if (isNaN(precoUnitario)) {
                    console.warn(`Linha ${i + 1}: Preço Unitário inválido "${row['Preço']}". Usando 0.`);
                    isValidRow = false;
                }
                row['Preço Unitário'] = precoUnitario;

                row['Preço Total'] = row['Quantidade'] * row['Preço Unitário'];
            }

            if (isValidRow) {
                parsedData.push(row);
            }
        }
        console.log(`CSV carregado com sucesso: ${parsedData.length} registros válidos.`);
        return parsedData;
    }

    // Função para inicializar os filtros
    function initializeFilters() {
        const cidades = [...new Set(salesData.map(item => item['Cidade']))].sort();
        cidades.forEach(cidade => {
            const option = document.createElement('option');
            option.value = cidade;
            option.textContent = cidade;
            filterCidade.appendChild(option);
        });

        const categorias = [...new Set(salesData.map(item => item['Categoria']))].sort();
        categorias.forEach(categoria => {
            const option = document.createElement('option');
            option.value = categoria;
            option.textContent = categoria;
            filterCategoria.appendChild(option);
        });

        const medicamentos = [...new Set(salesData.map(item => item['Medicamento']))].sort();
        medicamentos.forEach(medicamento => {
            const option = document.createElement('option');
            option.value = medicamento;
            option.textContent = medicamento;
            filterMedicamento.appendChild(option);
        });

        const vendedores = [...new Set(salesData.map(item => item['Vendedor']))].sort();
        vendedores.forEach(vendedor => {
            const option = document.createElement('option');
            option.value = vendedor;
            option.textContent = vendedor;
            filterVendedor.appendChild(option);
        });

        // Adicionar event listeners para os filtros
        filterCidade.addEventListener('change', applyFilters);
        filterCategoria.addEventListener('change', applyFilters);
        filterMedicamento.addEventListener('change', applyFilters);
        filterVendedor.addEventListener('change', applyFilters);
        filterPeriodo.addEventListener('change', applyFilters);
        projectionMetric.addEventListener('change', applyFilters); // NOVO: Event listener para a métrica da projeção
    }

    // Função para aplicar os filtros e atualizar o dashboard
    function applyFilters() {
        let filteredData = [...salesData];

        const selectedCidade = filterCidade.value;
        if (selectedCidade !== 'all') {
            filteredData = filteredData.filter(item => item['Cidade'] === selectedCidade);
        }

        const selectedCategoria = filterCategoria.value;
        if (selectedCategoria !== 'all') {
            filteredData = filteredData.filter(item => item['Categoria'] === selectedCategoria);
        }

        const selectedMedicamento = filterMedicamento.value;
        if (selectedMedicamento !== 'all') {
            filteredData = filteredData.filter(item => item['Medicamento'] === selectedMedicamento);
        }

        const selectedVendedor = filterVendedor.value;
        if (selectedVendedor !== 'all') {
            filteredData = filteredData.filter(item => item['Vendedor'] === selectedVendedor);
        }

        updateStats(filteredData);
        updateTable(filteredData);
        renderCharts(filteredData);
    }

    // Função para atualizar as estatísticas
    function updateStats(data) {
        const totalVendas = data.length;
        const receitaTotal = data.reduce((sum, item) => sum + item['Preço Total'], 0);
        const totalUnidades = data.reduce((sum, item) => sum + item['Quantidade'], 0);
        const ticketMedio = totalVendas > 0 ? receitaTotal / totalVendas : 0;

        const produtoCounts = {};
        data.forEach(item => {
            produtoCounts[item['Medicamento']] = (produtoCounts[item['Medicamento']] || 0) + item['Quantidade'];
        });

        let produtoTop = 'N/A';
        let maxCount = 0;
        for (const produto in produtoCounts) {
            if (produtoCounts[produto] > maxCount) {
                maxCount = produtoCounts[produto];
                produtoTop = produto;
            }
        }

        document.getElementById('totalVendas').textContent = totalVendas;
        document.getElementById('receitaTotal').textContent = formatCurrency(receitaTotal);
        document.getElementById('ticketMedio').textContent = formatCurrency(ticketMedio);
        document.getElementById('produtoTop').textContent = produtoTop;
        document.getElementById('totalUnidades').textContent = totalUnidades;

        document.getElementById('lastUpdateDate').textContent = new Date().toLocaleDateString('pt-BR');
    }

    // Função para atualizar a tabela
    function updateTable(data) {
        const salesTableBody = document.getElementById('salesTableBody');
        salesTableBody.innerHTML = ''; // Limpa a tabela

        data.forEach(item => {
            const row = salesTableBody.insertRow();
            row.insertCell().textContent = formatDate(item['Data']);
            row.insertCell().textContent = item['Medicamento'];
            row.insertCell().textContent = item['Categoria'];
            row.insertCell().textContent = item['Quantidade'];
            row.insertCell().textContent = formatCurrency(item['Preço Unitário']);
            row.insertCell().textContent = formatCurrency(item['Preço Total']);
            row.insertCell().textContent = item['Cidade'];
            row.insertCell().textContent = item['Vendedor'];
        });
    }

    // Função para renderizar os gráficos
    function renderCharts(data) {
        const selectedPeriod = filterPeriodo.value;
        const selectedProjectionMetric = projectionMetric.value; // NOVO: Obter a métrica selecionada

        // Agrupar dados para o histórico
        const groupedHistoryData = groupDataByPeriod(data, selectedPeriod);

        // Preparar dados para o histórico (sempre receita)
        const historyLabels = groupedHistoryData.map(item => item.period);
        const historyRevenueData = groupedHistoryData.map(item => item.revenue);

        // Preparar dados para a projeção (receita ou unidades)
        const projectionData = groupDataByPeriod(salesData, selectedPeriod); // Usar salesData completo para projeção
        const projectionLabels = projectionData.map(item => item.period);
        const projectionValues = projectionData.map(item => selectedProjectionMetric === 'revenue' ? item.revenue : item.units); // NOVO: Alternar entre receita e unidades

        // Gráfico de Histórico de Vendas
        const salesHistoryCtx = document.getElementById('salesHistoryChart').getContext('2d');
        if (salesHistoryChart) {
            salesHistoryChart.data.labels = historyLabels;
            salesHistoryChart.data.datasets[0].data = historyRevenueData;
            salesHistoryChart.update();
        } else {
            salesHistoryChart = new Chart(salesHistoryCtx, {
                type: 'bar',
                data: {
                    labels: historyLabels,
                    datasets: [{
                        label: 'Receita Total',
                        data: historyRevenueData,
                        backgroundColor: 'rgba(0, 72, 72, 0.6)',
                        borderColor: 'rgba(0, 72, 72, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: selectedPeriod,
                                displayFormats: {
                                    daily: 'dd/MM/yy',
                                    weekly: 'dd/MM/yy',
                                    monthly: 'MM/yy'
                                }
                            },
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
        }

        // Gráfico de Projeção de Vendas
        const salesProjectionCtx = document.getElementById('salesProjectionChart').getContext('2d');
        if (salesProjectionChart) {
            salesProjectionChart.data.labels = projectionLabels;
            salesProjectionChart.data.datasets[0].data = projectionValues;
            // NOVO: Atualizar o label do dataset e o título do eixo Y
            salesProjectionChart.data.datasets[0].label = selectedProjectionMetric === 'revenue' ? 'Receita Projetada' : 'Unidades Projetadas';
            salesProjectionChart.options.scales.y.title.text = selectedProjectionMetric === 'revenue' ? 'Receita (R$)' : 'Unidades';
            // NOVO: Atualizar o callback do tick e do tooltip
            salesProjectionChart.options.scales.y.ticks.callback = function(value) {
                return selectedProjectionMetric === 'revenue' ? formatCurrency(value) : value.toLocaleString('pt-BR');
            };
            salesProjectionChart.options.plugins.tooltip.callbacks.label = function(context) {
                let label = context.dataset.label || '';
                if (label) {
                    label += ': ';
                }
                if (context.parsed.y !== null) {
                    label += selectedProjectionMetric === 'revenue' ? formatCurrency(context.parsed.y) : context.parsed.y.toLocaleString('pt-BR');
                }
                return label;
            };
            salesProjectionChart.update();
        } else {
            salesProjectionChart = new Chart(salesProjectionCtx, {
                type: 'line',
                data: {
                    labels: projectionLabels,
                    datasets: [{
                        label: selectedProjectionMetric === 'revenue' ? 'Receita Projetada' : 'Unidades Projetadas', // NOVO: Label dinâmico
                        data: projectionValues,
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: selectedPeriod,
                                displayFormats: {
                                    daily: 'dd/MM/yy',
                                    weekly: 'dd/MM/yy',
                                    monthly: 'MM/yy'
                                }
                            },
                            title: {
                                display: true,
                                text: 'Período'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: selectedProjectionMetric === 'revenue' ? 'Receita (R$)' : 'Unidades' // NOVO: Título dinâmico
                            },
                            ticks: {
                                callback: function(value) {
                                    return selectedProjectionMetric === 'revenue' ? formatCurrency(value) : value.toLocaleString('pt-BR'); // NOVO: Callback dinâmico
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
                                        label += selectedProjectionMetric === 'revenue' ? formatCurrency(context.parsed.y) : context.parsed.y.toLocaleString('pt-BR'); // NOVO: Callback dinâmico
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
        }
    }

    // Função para agrupar dados por período (diário, semanal, mensal)
    function groupDataByPeriod(data, period) {
        const grouped = {};

        data.forEach(item => {
            let key;
            const date = item['Data'];

            if (period === 'daily') {
                key = date.toISOString().split('T')[0]; // YYYY-MM-DD
            } else if (period === 'weekly') {
                // Para semana, usar o primeiro dia da semana (domingo)
                const d = new Date(date);
                d.setDate(date.getDate() - date.getDay()); // Ir para o domingo da semana
                key = d.toISOString().split('T')[0];
            } else if (period === 'monthly') {
                key = date.toISOString().substring(0, 7); // YYYY-MM
            }

            if (!grouped[key]) {
                grouped[key] = {
                    period: key,
                    revenue: 0,
                    units: 0
                };
            }
            grouped[key].revenue += item['Preço Total'];
            grouped[key].units += item['Quantidade'];
        });

        // Converter para array e ordenar
        const result = Object.values(grouped).sort((a, b) => new Date(a.period) - new Date(b.period));

        return result;
    }

    // Inicialização
    document.addEventListener('DOMContentLoaded', async () => {
        salesData = await parseCSV();
        initializeFilters();
        applyFilters(); // Aplica os filtros iniciais e renderiza tudo
    });
