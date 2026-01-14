const API_URL = 'https://sales-prediction-mxgp.onrender.com/predict';

document.getElementById('predictionForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const investimentoTV = parseFloat(document.getElementById('investimento_tv').value);
    const investimentoRadio = parseFloat(document.getElementById('investimento_radio').value);
    const investimentoJornal = parseFloat(document.getElementById('investimento_jornal').value);

    const resultDiv = document.getElementById('result');
    const errorDiv = document.getElementById('error');
    const predictedValueSpan = document.getElementById('predictedValue');
    const errorMessageP = document.getElementById('errorMessage');

    // Esconder mensagens anteriores
    resultDiv.classList.add('hidden');
    errorDiv.classList.add('hidden');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                investimento_tv: investimentoTV,
                investimento_radio: investimentoRadio,
                investimento_jornal: investimentoJornal
            })
        });

        if (!response.ok) {
            throw new Error('Erro ao fazer a previsão');
        }

        const data = await response.json();

        // Formatar o valor em reais
        const valorFormatado = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(data.vendas_previstas);

        predictedValueSpan.textContent = valorFormatado;
        resultDiv.classList.remove('hidden');

    } catch (error) {
        errorMessageP.textContent = '❌ Erro ao conectar com o servidor. Tente novamente.';
        errorDiv.classList.remove('hidden');
        console.error('Erro:', error);
    }
});
