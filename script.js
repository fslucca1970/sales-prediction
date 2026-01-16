// As importações do Chart.js e do adaptador de data-fns são feitas no index.html

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

// Função auxiliar para parsear data. Espera YYYY-MM-DD ou DD/MM/YYYY.
function parseDateString(dateString) {
    // Tenta o formato YYYY-MM-DD primeiro (ISO 8601)
    let date = new Date(dateString);
    // Se for inválida, tenta o formato DD/MM/YYYY
    if (isNaN(date.getTime())) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Mês é 0-indexado
            const year = parseInt(parts[2], 10);
            date = new Date(year, month, day);
            // Validação extra para datas como 31/02
            if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
                return new Date('Invalid Date');
            }
        } else {
            return new Date('Invalid Date'); // Nem YYYY-MM-DD nem DD/MM/YYYY
        }
    }
    return date;
}

async function loadCSV() {
    try {
        const response = await fetch('vendas_farmacia.csv');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const csv = await response.text();
        parseCSV(csv);
    } catch (error) {
        console.error('Erro ao carregar CSV:', error);
        alert('Erro ao carregar dados. Verifique o console para mais detalhes.');
    }
}

function parseCSV(csv) {
    try {
        const lines = csv.trim().split('\n');
        if (lines.length < 2) {
            alert('CSV vazio ou inválido.');
            return;
        }

        let separator = ',';
        if (lines[0].includes(';')) {
            separator = ';';
        } else if (lines[0].includes('\t')) {
            separator = '\t';
        }

        const headers = lines[0].split(separator).map(h => h.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const currentLine = lines[i].trim();
            if (!currentLine) continue; // Pula linhas vazias

            const values = currentLine.split(separator);
            const row = {};
            let isValidRow = true;

            for (let j = 0; j < headers.length; j++) {
                row[headers[j]] = values[j] ? values[j].trim() : '';
            }

            // Validar e parsear dados
            const date = parseDateString(row['Data']);
            if (isNaN(date.getTime())) {
                console.warn(`Linha ${i + 1}: Data inválida "${row['Data']}". Linha ignorada.`);
                isValidRow = false;
            }
            row['Data'] = date; // Armazena o objeto Date parseado

            // Usar 'Preço' do CSV para Preço Unitário
            let precoUnitarioRaw = String(row['Preço'] || '0').replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
            const precoUnitario = parseFloat(precoUnitarioRaw);
            if (isNaN(precoUnitario)) {
                console.warn(`Linha ${i + 1}: Preço Unitário inválido "${row['Preço']}". Usando 0.`);
                isValidRow = false;
            }
            row['Preço Unitário'] = precoUnitario; // Armazenar como 'Preço Unitário' para consistência interna

            let quantidadeRaw = String(row['Quantidade'] || '0').replace('.', '').replace(',', '.').trim();
            const quantidade = parseInt(quantidadeRaw, 10);
            if (isNaN(quantidade)) {
                console.warn(`Linha ${i + 1}: Quantidade inválida "${row['Quantidade']}". Usando 1.`);
                isValidRow = false;
            }
            row['Quantidade'] = quantidade;

            // Calcular Preço Total, já que não há coluna 'Preço Total' no CSV
            row['Preço Total'] = precoUnitario * quantidade;

            if (isValidRow) {
                data.push(row);
            }
        }

        allData = data;
        console.log(`CSV carregado com sucesso: ${allData.length} registros válidos.`);
        updateLastUpdateDate(); // Atualiza a data da última atualização

        initializeFilters();
        applyFilters(); // Aplica os filtros iniciais e renderiza tudo
    } catch (error) {
        console.error('Erro ao processar dados do CSV:', error);
        alert('Erro ao processar dados do CSV. Verifique o console para mais detalhes.');
    }
}

function getUniqueValues(data, key) {
    const values = [...new Set(data.map(item => item[key]))].filter(Boolean); // Remove valores vazios/nulos
    return values.sort();
}

function populateSelect(elementId, items, defaultOptionText) {
    const select = document.getElementById(elementId);
    if (!select) {
        console.error(`Elemento com ID '${elementId}' não encontrado.`);
        return;
    }
    const currentSelection = select.value;
    select.innerHTML = `<option value="all">${defaultOptionText}</option>`; // Limpa e adiciona opção padrão

    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        select.appendChild(option);
    });
    // Tenta restaurar a seleção anterior, se ainda for uma opção válida
    if (items.includes(currentSelection) || currentSelection === 'all') {
        select.value = currentSelection;
    } else {
        select.value = 'all';
    }
    select.disabled = false; // Garante que o filtro esteja habilitado
}

function initializeFilters() {
    populateSelect('filterCidade', getUniqueValues(allData, 'Cidade'), 'Todas as Cidades');
    populateSelect('filterCategoria', getUniqueValues(allData, 'Categoria'), 'Todas as Categorias');
    populateSelect('filterMedicamento', getUniqueValues(allData, 'Medicamento'), 'Todos os Medicamentos');
    populateSelect('filterVendedor', getUniqueValues(allData, 'Vendedor'), 'Todos os Vendedores');

    // Adiciona event listeners para os filtros
    document.getElementById('filterCidade').addEventListener('change', () => {
        applyFilters();
        updateDependentFilters(); // Atualiza os filtros dependentes
    });
    document.getElementById('filterCategoria').addEventListener('change', () => {
        applyFilters();
        updateDependentFilters();
    });
    document.getElementById('filterMedicamento').addEventListener('change', () => {
        applyFilters();
        updateDependentFilters();
    });
    document.getElementById('filterVendedor').addEventListener('change', () => {
        applyFilters();
        updateDependentFilters();
    });
    document.getElementById('filterPeriodo').addEventListener('change', applyFilters);
    document.getElementById('projectionMetric').addEventListener('change', applyFilters);
    document.getElementById('clearBtn').addEventListener('click', clearFilters);
}

function updateDependentFilters() {
    const selectedCidade = document.getElementById('filterCidade').value;
    const selectedCategoria = document.getElementById('filterCategoria').value;
    const selectedMedicamento = document.getElementById('filterMedicamento').value;
    const selectedVendedor = document.getElementById('filterVendedor').value;

    let filtered = allData;

    if (selectedCidade !== 'all') {
        filtered = filtered.filter(item => item['Cidade'] === selectedCidade);
    }

    // Popula os filtros dependentes com base nos dados filtrados
    const categorias = [...new Set(filtered.map(item => item['Categoria']))].filter(Boolean).sort();
    const medicamentos = [...new

