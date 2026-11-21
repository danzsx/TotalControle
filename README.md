# TotalControle 🚀

Plataforma unificada e elegante para gestão autônoma da aprendizagem, preparação para concursos públicos e estudos de alta performance.

O **TotalControle** integra em uma única aplicação **Trilhas de Aprendizagem visuais**, **Ciclo de Estudos adaptativo**, **Caderno de Erros analítico** e **Cartas Colecionáveis 3D gamificadas**, com persistência local em **SQLite**.

---

## ✨ Principais Funcionalidades

### 🧭 1. Trilhas de Aprendizagem
- Navegação em níveis e módulos inspirada no conceito de jornada contínua.
- Acompanhamento do progresso de cada conteúdo com checklist prático, notas de estudo e registro de exercícios.
- Catálogo de trilhas pré-estruturadas prontas para uso (com suporte completo para editais como **Analista de Tecnologia da Informação**, contemplando RLM, Português, Conhecimentos Gerais e tópicos de TI como Governança, Redes, Infraestrutura, Banco de Dados, Desenvolvimento, Segurança da Informação e Legislação).
- **Mover disciplinas entre concursos**: facilidade para transferir matérias entre editais ou concursos cadastrados.

### 🔄 2. Ciclo de Estudos Inteligente
- Algoritmo de distribuição ponderada baseado em peso, dificuldade e tempo planejado.
- Cronômetro de foco integrado com controle de pausas, retomadas e registro de notas de sessão.
- Ajuste dinâmico de blocos e cálculo de tempos ideais de estudo.

### 📖 3. Caderno de Erros (ERRATA)
- Registro analítico de erros em questões por prioridade (alta, média, superado) e origem (conceito, pegadinha, distração, interpretação).
- Fila de revisão ativa espaçada para fixar conteúdos desafiadores.
- Estatísticas de superação de falhas e evolução de desempenho.

### 🃏 4. Cartas Colecionáveis 3D (Gamificação)
- Desbloqueio progressivo de cartas holográficas e 3D conforme o estudante avança nas trilhas e sessões de estudo.
- Modal de inspeção detalhada em 3D com histórico e metadados de maestria.

### 📊 5. Painel de Estatísticas Sereno
- Visualização limpa e equilibrada focada em azul e verde.
- Gráficos diários de tempo dedicado por período (7d, 30d, 90d e total).
- Mapa de constância em 16 semanas no estilo heatmap verde.
- Sequência de foco (streak) e histórico unificado de sessões.

### 🎯 6. Multi-Concursos
- Gerenciamento completo de múltiplos concursos ou objetivos em paralelo.
- Visualização expandida das disciplinas vinculadas a cada concurso com opção de migração de matérias entre eles em tempo real.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Outfit & Plus Jakarta Sans fonts.
- **Desktop**: Electron 34 com empacotamento multiplataforma via electron-builder.
- **Banco de Dados**: SQLite local via `sql.js` (WebAssembly) com persistência atômica em disco / IndexedDB de fallback.
- **Build & Testes**: Vite 6, Vitest.

---

## 📦 Como Executar o Projeto

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- npm ou pnpm

### Instalação

```bash
# Clone o repositório
git clone https://github.com/danzsx/TotalControle.git
cd TotalControle

# Instale as dependências
npm install
```

### Executando em Modo Desenvolvimento

```bash
# Executar a interface web
npm run dev

# Ou executar no Electron desktop
npm run electron:dev
```

### Testes e Validação

```bash
# Executar a suíte de testes unitários
npm test

# Verificar compilação TypeScript e empacotar frontend
npm run build
```

---

## 📄 Licença

Este projeto é desenvolvido para fins educacionais e de produtividade pessoal.
