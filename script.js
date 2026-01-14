const API_URL = 'https://sales-prediction-api.onrender.com';

// Carregar estatísticas ao iniciar
document.addEventListener('DOMContentLoaded', () => {
    carregarEstatisticas();
    carregarTopProdutos();
});

async function carregarEstatisticas() {
    try {
        const response = await fetch(`${API_URL}/stats`);
        const data = await response.json();

        document.getElementById('statsGrid').innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">💰</div>
                <h3>Receita Total</h3>
                <p class="stat-value">${data.receita_total}</p>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📦</div>
                <h3>Total de Vendas</h3>
                <p class="stat-value">${data.total_vendas}</p>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🎯</div>
                <h3>Ticket Médio</h3>
                <p class="stat-value">${data.ticket_medio}</p>
            </div>
            <div class="stat-card">
                <div class="stat-icon">⭐</div>
                <h3>Produto Top</h3>
                <p class="stat-value">${data.produto_mais_vendido}</p>
            </div>
        `;
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        document.getElementById('statsGrid').innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">⚠️</div>
                <h3>Erro</h3>
                <p class="stat-value">API indisponível</p>
            </div>
        `;
    }
}

async function gerarPrevisao() {
    const dias = document.getElementById('diasPrevisao').value;
    const resultsDiv = document.getElementById('predictionResults');

    resultsDiv.innerHTML = '<div class="loading-spinner">Gerando previsão...</div>';

    try {
        const response = await fetch(`${API_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dias: parseInt(dias) })
        });

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const data = await response.json();

        let tableHTML = `
            <div style="margin-bottom: 20px; padding: 15px; background: #F0F9FF; border-radius: 8px; border-left: 4px solid var(--primary);">
                <strong>📊 Modelo:</strong> ${data.modelo} | 
                <strong>✅ Confiança:</strong> ${data.confianca}
            </div>
            <table class="prediction-table">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Vendas Previstas</th>
                        <th>Receita Prevista</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.predicoes.forEach((pred, index) => {
            tableHTML += `
                <tr>
                    <td><strong>${pred.data}</strong></td>
                    <td>${pred.vendas_previstas} unidades</td>
                    <td><strong>${pred.receita_prevista}</strong></td>
                </tr>
            `;
        });

        tableHTML += '</tbody></table>';
        resultsDiv.innerHTML = tableHTML;

    } catch (error) {
        console.error('Erro ao gerar previsão:', error);
        resultsDiv.innerHTML = `
            <div class="empty-state">
                <p>❌ Erro ao gerar previsão: ${error.message}</p>
                <p style="font-size: 14px; margin-top: 10px; color: var(--gray);">
                    Verifique se a API está rodando no Render.
                </p>
            </div>
        `;
    }
}

async function carregarTopProdutos() {
    try {
        const response = await fetch(`${API_URL}/top-produtos`);

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const produtos = await response.json();

        const grid = document.getElementById('topProdutos');
        grid.innerHTML = produtos.map((p, i) => `
            <div class="produto-card">
                <div class="produto-rank">${i + 1}</div>
                <div class="produto-nome">${p.produto}</div>
                <div class="produto-vendas">📦 ${p.vendas} vendas</div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        document.getElementById('topProdutos').innerHTML = `
            <div class="loading-spinner">
                ⚠️ Erro ao carregar produtos
            </div>
        `;
    }
}

function scrollToSection(id) {
    const element = document.getElementById(id);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}
