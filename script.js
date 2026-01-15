let allData = [];

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

            // Correção CRÍTICA: Usar 'Preço' do CSV para Preço Unitário
            let precoUnitarioRaw = String(row['Preço']).replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
            const precoUnitario = parseFloat(precoUnitarioRaw);
            if (isNaN(precoUnitario)) {
                console.warn(`Linha ${i + 1}: Preço Unitário inválido "${row['Preço']}". Linha ignorada.`);
                isValidRow = false;
            }
            row['Preço Unitário'] = precoUnitario; // Armazenar como 'Preço Unitário' para consistência interna

            let quantidadeRaw = String(row['Quantidade']).replace('.', '').replace(',', '.').trim();
            const quantidade = parseInt(quantidadeRaw, 10);
            if (isNaN(quantidade)) {
                console.warn(`Linha ${i + 1}: Quantidade inválida "${row['Quantidade']}". Linha ignorada.`);
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
        document.getElementById('lastUpdateDate').textContent = new Date().toLocaleDateString('pt-BR');
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
    select.disabled = items.length === 0;
}

function initializeFilters() {
    populateSelect('filterCidade', getUniqueValues(allData, 'Cidade'), 'Todas as Cidades');
    populateSelect('filterCategoria', getUniqueValues(allData, 'Categoria'), 'Todas as Categorias');
    populateSelect('filterMedicamento', getUniqueValues(allData, 'Medicamento'), 'Todos os Medicamentos');
    populateSelect('filterVendedor', getUniqueValues(allData, 'Vendedor'), 'Todos os Vendedores');

    document.getElementById('filterCidade').addEventListener('change', applyFilters);
    document.getElementById('filterCategoria').addEventListener('change', applyFilters);
    document.getElementById('filterMedicamento').addEventListener('change', applyFilters);
    document.getElementById('filterVendedor').addEventListener('change', applyFilters);
}

function applyFilters() {
    const selectedCidade = document.getElementById('filterCidade').value;
    const selectedCategoria = document.getElementById('filterCategoria').value;
    const selectedMedicamento = document.getElementById('filterMedicamento').value;
    const selectedVendedor = document.getElementById('filterVendedor').value;

    let filteredData = allData.filter(item => {
        return (selectedCidade === 'all' || item['Cidade'] === selectedCidade) &&
               (selectedCategoria === 'all' || item['Categoria'] === selectedCategoria) &&
               (selectedMedicamento === 'all' || item['Medicamento'] === selectedMedicamento) &&
               (selectedVendedor === 'all' || item['Vendedor'] === selectedVendedor);
    });

    updateStats(filteredData);
    updateTable(filteredData); // Chamada correta para a função de atualização da tabela
}

function updateStats(data) {
    const totalSales = data.length;
    const totalRevenue = data.reduce((sum, item) => sum + item['Preço Total'], 0);
    const totalUnits = data.reduce((sum, item) => sum + item['Quantidade'], 0);
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    const productCounts = {};
    data.forEach(item => {
        productCounts[item['Medicamento']] = (productCounts[item['Medicamento']] || 0) + item['Quantidade'];
    });

    const topProduct = Object.keys(productCounts).length > 0
        ? Object.keys(productCounts).sort((a, b) => productCounts[b] - productCounts[a])[0]
        : 'N/A';

    document.getElementById('totalSales').textContent = formatNumber(totalSales);
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('averageTicket').textContent = formatCurrency(averageTicket);
    document.getElementById('topProduct').textContent = topProduct;
    document.getElementById('totalUnits').textContent = formatNumber(totalUnits); // Adicionado para unidades
}

function updateTable(data) {
    const tableBody = document.getElementById('salesTableBody');
    if (!tableBody) {
        console.error("Elemento 'salesTableBody' não encontrado.");
        return;
    }
    tableBody.innerHTML = ''; // Limpa a tabela

    // Limita a exibição a um número razoável de linhas para evitar sobrecarga
    const displayLimit = 500;
    const dataToDisplay = data.slice(0, displayLimit);

    dataToDisplay.forEach(item => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = item['Data'].toLocaleDateString('pt-BR');
        row.insertCell().textContent = item['Medicamento'];
        row.insertCell().textContent = item['Categoria'];
        row.insertCell().textContent = formatNumber(item['Quantidade']);
        row.insertCell().textContent = formatCurrency(item['Preço Unitário']);
        row.insertCell().textContent = formatCurrency(item['Preço Total']);
        row.insertCell().textContent = item['Cidade'];
        row.insertCell().textContent = item['Vendedor'];
    });

    if (data.length > displayLimit) {
        console.warn(`Exibindo apenas as primeiras ${displayLimit} linhas. Total de registros: ${data.length}`);
    }
}

// Inicializa o carregamento do CSV quando a página é carregada
document.addEventListener('DOMContentLoaded', loadCSV);
