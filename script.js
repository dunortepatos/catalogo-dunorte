/* =============================================
   GRUPO DUNORTE — script.js
   ============================================= */

(function () {
  "use strict";

  // ── Utilitários ────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const fmt = {
    preco(v) {
      return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    },
    parcela(v) {
      // "ou 10x de R$ X,XX sem juros"
      const val = Number(v || 0) / 10;
      return `ou 10x de ${val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} sem juros`;
    },
    metros(cm) {
      return (Number(cm || 0) / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      }) + " m";
    },
  };

  // Garantia por categoria
  function garantiaDe(categoria) {
    const premium = ["Mesa Com Borda Requadrada", "Mesa Com Borda Orgânica", "Mesa Cascata", "Mesa Redonda"];
    if (premium.includes(categoria)) return "1 ano de garantia";
    return "90 dias contra defeitos de fabricação";
  }

  // ── Estado ────────────────────────────────────────────────
  let todosOsProdutos = [];
  let imagensModal = [];
  let indiceAtual = 0;
  let descExpanded = false;

  // Cache de verificação de imagens (pasta => true/false)
  const cacheImagem = {};

  // ── Elementos ─────────────────────────────────────────────
  const listaProdutos   = $("#listaProdutos");
  const contador        = $("#contadorProdutos");
  const modal           = $("#modalProduto");
  const modalOverlay    = $("#modalOverlay");
  const modalConteudo   = $("#modalConteudo");
  const fecharModal     = $("#fecharModal");
  const buscaNome       = $("#buscaNome");
  const ordenarProdutos = $("#ordenarProdutos");
  const filtroPromo     = $("#filtroPromo");

  // ── Sidebar toggle (mobile) ───────────────────────────────
  window.toggleSidebar = function () {
    $("#sidebar").classList.toggle("visivel");
  };

  // ── Verifica se produto tem foto ──────────────────────────
  function verificarImagem(pasta) {
    return new Promise((resolve) => {
      if (cacheImagem[pasta] !== undefined) { resolve(cacheImagem[pasta]); return; }
      const img = new Image();
      img.onload  = () => { cacheImagem[pasta] = true;  resolve(true); };
      img.onerror = () => { cacheImagem[pasta] = false; resolve(false); };
      img.src = `assets/img/${pasta}/1.jpg`;
    });
  }

  // ── Configuração GitHub Pages ─────────────────────────────
  // URL do produtos.json no seu repositório GitHub
  // Troque SEU_USUARIO pelo seu nome de usuário do GitHub
  const URL_PRODUTOS = "https://dunortepatos.github.io/catalogo-dunorte/produtos.json";

  // ── Carregar produtos ─────────────────────────────────────
  async function init() {
    try {
      // Adiciona timestamp para evitar cache do navegador
      const r = await fetch(URL_PRODUTOS + "?v=" + Date.now());
      if (!r.ok) throw new Error("Erro ao carregar produtos");
      todosOsProdutos = await r.json();
      if (!Array.isArray(todosOsProdutos)) todosOsProdutos = [];
    } catch (e) {
      console.error("Não foi possível carregar produtos:", e);
      todosOsProdutos = [];
    }

    // Verifica imagens em paralelo e armazena em cache
    await Promise.all(todosOsProdutos.map((p) => verificarImagem(p.pasta)));

    construirFiltros();
    lerUrlFiltros();
    renderizar();
  }

  // ── Construir filtros dinâmicos ────────────────────────────
  function construirFiltros() {
    // Categoria e Madeira: simples
    [
      { el: "#filtroCategoria", chave: "categoria" },
      { el: "#filtroMadeira",   chave: "madeira" },
    ].forEach(({ el, chave }) => {
      const container = $(el);
      if (!container) return;
      const vals = [...new Set(todosOsProdutos.map((p) => p[chave]).filter(Boolean))].sort();
      container.innerHTML = vals.map((v) => `
        <label class="check-item">
          <input type="checkbox" data-chave="${chave}" value="${v}">
          <span class="check-box"></span>
          <span>${v}</span>
        </label>`).join("");
    });

    // Tipo de pé: agrupado por material, expansível
    // Lógica: o valor completo vem do admin (ex: 'Metal — "U" 70x30mm').
    // Se contém ' — ', agrupa pelo que vem ANTES e exibe o que vem DEPOIS como label.
    // Se não contém ' — ' (ex: 'Alumínio'), vira um checkbox simples sem grupo.
    const containerPe = $("#filtroTipoPe");
    if (containerPe) {
      const todosPes = [...new Set(todosOsProdutos.map((p) => p.tipoPe).filter(Boolean))].sort();

      // Separador canônico usado no admin
      const SEP = " — ";

      // Monta grupos: { "Metal": ["Metal — U 70x30mm", ...], "Alumínio": ["Alumínio"] }
      const grupos = {};
      todosPes.forEach((v) => {
        const idx = v.indexOf(SEP);
        // Se tem separador, o material é o que vem antes; senão, o valor inteiro é o material
        const mat = idx !== -1 ? v.slice(0, idx) : v;
        if (!grupos[mat]) grupos[mat] = [];
        grupos[mat].push(v);
      });

      let html = "";
      Object.entries(grupos).forEach(([material, subs]) => {

        // Sem subcategorias (ex: Alumínio sem modelo) → checkbox simples
        if (subs.length === 1 && !subs[0].includes(SEP)) {
          html += `
            <label class="check-item">
              <input type="checkbox" data-chave="tipoPe" value="${subs[0]}">
              <span class="check-box"></span>
              <span>${material}</span>
            </label>`;
          return;
        }

        // Com subcategorias → grupo expansível
        // Label exibido = o que vem depois do " — "
        const subsHTML = subs.map((v) => {
          const idx   = v.indexOf(SEP);
          const label = idx !== -1 ? v.slice(idx + SEP.length) : v;
          return `
            <label class="pe-sub">
              <input type="checkbox" data-chave="tipoPe" value="${v}">
              <span class="pe-check-box"></span>
              <span class="pe-sub-label">${label}</span>
            </label>`;
        }).join("");

        html += `
          <div class="pe-grupo">
            <button type="button" class="pe-principal" data-material="${material}">
              <span>${material}</span>
              <span class="pe-seta">&#9654;</span>
            </button>
            <div class="pe-subs" id="peSubs_${material}">
              ${subsHTML}
            </div>
          </div>`;
      });

      containerPe.innerHTML = html;

      // Toggle ao clicar no botão principal
      containerPe.querySelectorAll(".pe-principal").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const mat     = btn.getAttribute("data-material");
          const subsDiv = document.getElementById("peSubs_" + mat);
          const seta    = btn.querySelector(".pe-seta");
          if (!subsDiv) return;
          const abrindo = !subsDiv.classList.contains("visivel");
          subsDiv.classList.toggle("visivel", abrindo);
          if (seta) seta.style.transform = abrindo ? "rotate(90deg)" : "";
        });
      });

      // Checkboxes das subcategorias disparam renderizar
      containerPe.querySelectorAll(".pe-sub input[type=checkbox]").forEach((cb) => {
        cb.addEventListener("change", renderizar);
      });
    }

    // Eventos nos checks de categoria e madeira
    $$("#filtroCategoria input, #filtroMadeira input").forEach((cb) => {
      cb.addEventListener("change", renderizar);
    });
  }

  // ── Obter filtros ativos ───────────────────────────────────
  function getChecks(chave) {
    return $$(`input[data-chave="${chave}"]:checked`).map((cb) => cb.value);
  }

  // ── Filtrar ────────────────────────────────────────────────
  function filtrarProdutos() {
    const busca      = (buscaNome?.value || "").trim().toLowerCase();
    const categorias = getChecks("categoria");
    const madeiras   = getChecks("madeira");
    const pes        = getChecks("tipoPe");
    const soPromo    = filtroPromo?.checked;

    const pMin = Number($("#precoMin")?.value || 0);
    const pMax = Number($("#precoMax")?.value || 0);
    const cMin = Number($("#comprimentoMin")?.value || 0);
    const cMax = Number($("#comprimentoMax")?.value || 0);
    const lMin = Number($("#larguraMin")?.value || 0);
    const lMax = Number($("#larguraMax")?.value || 0);
    const eMin = Number($("#espessuraMin")?.value || 0);
    const eMax = Number($("#espessuraMax")?.value || 0);

    return todosOsProdutos.filter((p) => {
      if (busca) {
        const h = `${p.nome} ${p.codigo} ${p.madeira} ${p.categoria} ${p.descricao || ""}`.toLowerCase();
        if (!h.includes(busca)) return false;
      }
      if (categorias.length && !categorias.includes(p.categoria)) return false;
      if (madeiras.length   && !madeiras.includes(p.madeira))     return false;
      if (pes.length        && !pes.includes(p.tipoPe))           return false;
      if (soPromo           && !p.promocao)                        return false;

      const pe = p.promocao || p.preco;
      if (pMin && pe < pMin) return false;
      if (pMax && pe > pMax) return false;
      if (cMin && p.comprimento < cMin) return false;
      if (cMax && p.comprimento > cMax) return false;
      if (lMin && p.largura < lMin) return false;
      if (lMax && p.largura > lMax) return false;
      if (eMin && p.espessura < eMin) return false;
      if (eMax && p.espessura > eMax) return false;

      return true;
    });
  }

  // ── Ordenar (com foto primeiro) ────────────────────────────
  function ordenar(lista) {
    const modo = ordenarProdutos?.value || "recentes";

    // Separa com foto e sem foto
    const comFoto  = lista.filter((p) => cacheImagem[p.pasta] === true);
    const semFoto  = lista.filter((p) => cacheImagem[p.pasta] !== true);

    function sortFn(a, b) {
      if (modo === "recentes")    return Number(b.id) - Number(a.id);
      if (modo === "preco-menor") return (a.promocao || a.preco) - (b.promocao || b.preco);
      if (modo === "preco-maior") return (b.promocao || b.preco) - (a.promocao || a.preco);
      if (modo === "promo") {
        const da = a.promocao ? a.preco - a.promocao : 0;
        const db = b.promocao ? b.preco - b.promocao : 0;
        return db - da;
      }
      return 0;
    }

    // Dentro de cada grupo, ordena aleatoriamente quando modo = "recentes"
    // (mantém id desc como critério secundário estável, mas embaralha ligeiramente)
    // Conforme solicitado: com foto aparece em ordem aleatória, sem foto vai por último
    if (modo === "recentes") {
      // Aleatoriza os com foto
      const shuffled = comFoto.sort(() => 0.5 - Math.random());
      return [...shuffled, ...semFoto];
    }

    return [...comFoto.sort(sortFn), ...semFoto.sort(sortFn)];
  }

  // ── Montar nome do produto ─────────────────────────────────
  // Em mobile, abrevia a madeira se necessário para garantir que
  // "Cod. XXXX" nunca seja cortado pelo line-clamp.
  function montarNome(p) {
    const sufixo = " - Cod. " + (p.codigo || "");
    const madeira = p.madeira || "";

    // Em mobile (cards de 2 colunas, ~155px de texto, ~24 chars/linha, 2 linhas = 48 chars max):
    // - prefixo fixo "Mesa de Madeira Maciça - " = 25 chars
    // - sufixo " - Cod. XXXX" = ~12 chars
    // - sobram ~11 chars para a madeira → abreviar se > 9 chars
    let madeiraExibida = madeira;
    if (window.innerWidth < 640 && madeira.length > 9) {
      madeiraExibida = madeira.slice(0, 6).trimEnd() + "...";
    }

    return "Mesa de Madeira Maciça - " + madeiraExibida + sufixo;
  }

  // ── Render cards ───────────────────────────────────────────
  function renderizar() {
    const lista = ordenar(filtrarProdutos());
    contador.textContent = `${lista.length} produto${lista.length !== 1 ? "s" : ""}`;

    if (!lista.length) {
      listaProdutos.innerHTML = `
        <div class="sem-resultados">
          <p>Nenhum produto encontrado</p>
          <p style="font-size:14px;">Tente ajustar os filtros.</p>
        </div>`;
      return;
    }

    listaProdutos.innerHTML = lista.map(cardHTML).join("");

    $$(".card").forEach((card, i) => {
      card.addEventListener("click", (e) => {
        if (e.target.tagName === "A") return;
        abrirModal(lista[i]);
      });
    });
  }

  function cardHTML(p) {
    const img = `assets/img/${p.pasta}/1.jpg`;
    const temPromo = p.promocao && p.promocao < p.preco;
    const precoExibido = temPromo ? p.promocao : p.preco;
    const wppTxt = encodeURIComponent(
      `Olá! Tenho interesse na mesa *${p.nome}* (Cod. ${p.codigo}). Poderia me informar mais detalhes?`
    );
    const wppLink = `https://wa.me/553497724000?text=${wppTxt}`;

    return `
      <article class="card">
        <div class="card-img-wrap">
          ${temPromo ? `<span class="badge-oferta">Oferta</span>` : ""}
          <img src="${img}" alt="${p.nome}" loading="lazy"
            onerror="this.parentElement.style.background='#f0ead9'; this.style.display='none'">
        </div>
        <div class="card-body">
          <div class="card-madeira">${p.madeira}</div>
          <div class="card-nome">${montarNome(p)}</div>
          <div class="card-specs">${p.comprimento} × ${p.largura} cm &bull; ${p.espessura} cm &bull; Pé ${p.tipoPe}</div>
          <div class="card-preco-bloco">
            ${temPromo ? `<div class="card-preco-antigo">${fmt.preco(p.preco)}</div>` : ""}
            <div class="card-preco-atual${temPromo ? " promo" : ""}">${fmt.preco(precoExibido)}</div>
            <div class="card-parcela">${fmt.parcela(precoExibido)}</div>
          </div>
          <div class="card-acoes">
            <a href="${wppLink}" target="_blank" class="btn-wpp" onclick="event.stopPropagation()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </a>
            <button class="btn-ver">Ver detalhes</button>
          </div>
        </div>
      </article>`;
  }

  // ── Modal ──────────────────────────────────────────────────
  function abrirModal(p) {
    descExpanded = false;
    imagensModal = [];
    indiceAtual = 0;

    const promises = [];
    for (let i = 1; i <= 20; i++) {
      const src = `assets/img/${p.pasta}/${i}.jpg`;
      promises.push(new Promise((res) => {
        const img = new Image();
        img.onload  = () => { imagensModal.push(src); res(); };
        img.onerror = () => res();
        img.src = src;
      }));
    }

    Promise.all(promises).then(() => {
      imagensModal.sort((a, b) => {
        const na = parseInt(a.match(/\/(\d+)\.jpg/)?.[1] || 0);
        const nb = parseInt(b.match(/\/(\d+)\.jpg/)?.[1] || 0);
        return na - nb;
      });
      renderModal(p);
    });

    renderModal(p, true);
    modal.classList.add("aberto");
    document.body.style.overflow = "hidden";
  }

  function renderModal(p) {
    const temPromo = p.promocao && p.promocao < p.preco;
    const precoFinal = temPromo ? p.promocao : p.preco;
    const wppTxt = encodeURIComponent(
      `Olá! Tenho interesse na mesa *${p.nome}* (Cod. ${p.codigo}). Poderia me passar mais detalhes?`
    );
    const wppLink = `https://wa.me/553497724000?text=${wppTxt}`;
    const srcAtual = imagensModal[indiceAtual] || `assets/img/${p.pasta}/1.jpg`;
    const garantia = garantiaDe(p.categoria);

    modalConteudo.innerHTML = `
      <div class="modal-grid">
        <div class="modal-galeria">
          <div class="modal-img-principal">
            <img id="modalImgPrinc" src="${srcAtual}" alt="${p.nome}"
              onerror="this.parentElement.style.background='#f0ead9'; this.style.display='none'">
            ${imagensModal.length > 1 ? `
              <button class="seta-gal seta-ant" id="setaAnt">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button class="seta-gal seta-prox" id="setaProx">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>` : ""}
          </div>
          ${imagensModal.length > 1 ? `
            <div class="modal-miniaturas">
              ${imagensModal.map((src, i) => `
                <button class="min-btn${i === indiceAtual ? " ativa" : ""}" data-i="${i}">
                  <img src="${src}" alt="Foto ${i+1}">
                </button>`).join("")}
            </div>` : ""}
        </div>

        <div class="modal-info">
          <div class="modal-categoria">${p.categoria}</div>
          <h2 class="modal-nome">${p.nome}</h2>
          <div class="modal-cod">Cód. ${p.codigo}</div>

          <div class="modal-divider"></div>

          <div class="specs-grid">
            <div class="spec-item">
              <div class="spec-label">Comprimento</div>
              <div class="spec-val">${fmt.metros(p.comprimento)}</div>
            </div>
            <div class="spec-item">
              <div class="spec-label">Largura</div>
              <div class="spec-val">${p.largura} cm</div>
            </div>
            <div class="spec-item">
              <div class="spec-label">Espessura</div>
              <div class="spec-val">${p.espessura} cm</div>
            </div>
            <div class="spec-item">
              <div class="spec-label">Pé</div>
              <div class="spec-val">${p.tipoPe}</div>
            </div>
            <div class="spec-item">
              <div class="spec-label">Madeira</div>
              <div class="spec-val">${p.madeira}</div>
            </div>
            <div class="spec-item spec-garantia">
              <div class="spec-label">Garantia</div>
              <div class="spec-val">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                ${garantia}
              </div>
            </div>
          </div>

          <div class="modal-divider"></div>

          <div class="modal-preco-wrap">
            ${temPromo ? `<div class="modal-preco-antigo">${fmt.preco(p.preco)}</div>` : ""}
            <div class="modal-preco">${fmt.preco(precoFinal)}</div>
            <div class="modal-parcela">${fmt.parcela(precoFinal)}</div>
          </div>

          ${p.descricao ? `
            <button class="modal-desc-toggle" id="toggleDesc">
              Detalhes completos
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="toggleIcon"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="modal-desc" id="modalDesc" style="display:none">${p.descricao}</div>
          ` : ""}

          <div class="modal-acoes">
            <a href="${wppLink}" target="_blank" class="modal-btn-wpp">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Falar pelo WhatsApp
            </a>
            <button class="modal-btn-copiar" id="btnCopiarProduto">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span id="btnCopiarProdutoTxt">Copiar link desta mesa</span>
            </button>
          </div>
        </div>
      </div>`;

    const setaAnt  = $("#setaAnt");
    const setaProx = $("#setaProx");
    if (setaAnt)  setaAnt.addEventListener("click",  () => navegarGaleria(-1, p));
    if (setaProx) setaProx.addEventListener("click", () => navegarGaleria(1, p));

    $$(".min-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        indiceAtual = Number(btn.dataset.i);
        renderModal(p);
      });
    });

    const toggleBtn  = $("#toggleDesc");
    const modalDesc  = $("#modalDesc");
    const toggleIcon = $("#toggleIcon");
    if (toggleBtn && modalDesc) {
      toggleBtn.addEventListener("click", () => {
        descExpanded = !descExpanded;
        modalDesc.style.display = descExpanded ? "block" : "none";
        if (toggleIcon) toggleIcon.style.transform = descExpanded ? "rotate(180deg)" : "";
      });
    }

    // Botão copiar link do produto
    const btnCopiarProduto    = $("#btnCopiarProduto");
    const btnCopiarProdutoTxt = $("#btnCopiarProdutoTxt");
    if (btnCopiarProduto && btnCopiarProdutoTxt) {
      btnCopiarProduto.addEventListener("click", () => {
        copiarTexto(gerarUrlProduto(p), btnCopiarProduto, btnCopiarProdutoTxt, "✓ Copiado!");
      });
    }
  }

  function navegarGaleria(dir, p) {
    indiceAtual = (indiceAtual + dir + imagensModal.length) % imagensModal.length;
    renderModal(p);
  }

  function fecharModalFn() {
    modal.classList.remove("aberto");
    document.body.style.overflow = "";
  }

  fecharModal?.addEventListener("click", fecharModalFn);
  modalOverlay?.addEventListener("click", fecharModalFn);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharModalFn(); });

  $("#btnLimparFiltros")?.addEventListener("click", () => {
    $$("input[type=checkbox]").forEach((cb) => (cb.checked = false));
    $$("input[type=number]").forEach((i) => (i.value = ""));
    if (buscaNome) buscaNome.value = "";
    // Fecha todos os grupos de pé
    $$(".pe-subs").forEach((s) => s.classList.remove("visivel"));
    $$(".pe-seta").forEach((s) => s.classList.remove("aberto"));
    renderizar();
  });

  [buscaNome, filtroPromo, ordenarProdutos,
   $("#precoMin"), $("#precoMax"),
   $("#comprimentoMin"), $("#comprimentoMax"),
   $("#larguraMin"), $("#larguraMax"),
   $("#espessuraMin"), $("#espessuraMax"),
  ].forEach((el) => {
    if (el) el.addEventListener("input",  renderizar);
    if (el) el.addEventListener("change", renderizar);
  });

  // ── URL: ler filtros ao abrir a página ────────────────────
  function lerUrlFiltros() {
    const params = new URLSearchParams(window.location.search);

    ["categoria", "madeira", "tipoPe"].forEach((chave) => {
      params.getAll(chave).forEach((v) => {
        const cb = document.querySelector(`input[data-chave="${chave}"][value="${CSS.escape(v)}"]`);
        if (cb) {
          cb.checked = true;
          if (chave === "tipoPe") {
            const subsDiv = cb.closest(".pe-subs");
            if (subsDiv) {
              subsDiv.classList.add("visivel");
              const mat  = subsDiv.id.replace("peSubs_", "");
              const seta = document.querySelector(`.pe-principal[data-material="${mat}"] .pe-seta`);
              if (seta) seta.style.transform = "rotate(90deg)";
            }
          }
        }
      });
    });

    if (params.get("promo") === "1" && filtroPromo) filtroPromo.checked = true;
    if (params.get("busca") && buscaNome) buscaNome.value = params.get("busca");
    if (params.get("ordem") && ordenarProdutos) ordenarProdutos.value = params.get("ordem");

    ["precoMin","precoMax","comprimentoMin","comprimentoMax",
     "larguraMin","larguraMax","espessuraMin","espessuraMax"].forEach((id) => {
      const el = document.getElementById(id);
      if (el && params.get(id)) el.value = params.get(id);
    });

    const idProduto = params.get("produto");
    if (idProduto) {
      const p = todosOsProdutos.find((x) => String(x.id) === String(idProduto));
      if (p) abrirModal(p);
    }
  }

  // ── URL: gerar link com filtros ativos ────────────────────
  function gerarUrlFiltros() {
    const base   = "https://dunortepatos.github.io/catalogo-dunorte/";
    const params = new URLSearchParams();

    getChecks("categoria").forEach((v) => params.append("categoria", v));
    getChecks("madeira").forEach((v)   => params.append("madeira",   v));
    getChecks("tipoPe").forEach((v)    => params.append("tipoPe",    v));
    if (filtroPromo?.checked)           params.set("promo",  "1");
    if (buscaNome?.value.trim())        params.set("busca",  buscaNome.value.trim());
    if (ordenarProdutos?.value && ordenarProdutos.value !== "recentes")
                                        params.set("ordem",  ordenarProdutos.value);

    ["precoMin","precoMax","comprimentoMin","comprimentoMax",
     "larguraMin","larguraMax","espessuraMin","espessuraMax"].forEach((id) => {
      const el = document.getElementById(id);
      if (el?.value) params.set(id, el.value);
    });

    const qs = params.toString();
    return qs ? base + "?" + qs : base;
  }

  // ── URL: gerar link de produto individual ─────────────────
  function gerarUrlProduto(p) {
    return `https://dunortepatos.github.io/catalogo-dunorte/?produto=${p.id}`;
  }

  // ── Copiar para área de transferência ─────────────────────
  function copiarTexto(texto, btnEl, labelEl, msgOk) {
    // Tenta navigator.clipboard (HTTPS), cai para execCommand (HTTP/local)
    const fazer = () => {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(texto);
      }
      // fallback para localhost / HTTP
      const ta = document.createElement("textarea");
      ta.value = texto;
      ta.style.cssText = "position:fixed;opacity:0;pointer-events:none;";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return Promise.resolve();
    };

    fazer().then(() => {
      const original = labelEl.textContent;
      labelEl.textContent = msgOk || "✓ Copiado!";
      btnEl.classList.add("copiado");
      setTimeout(() => {
        labelEl.textContent = original;
        btnEl.classList.remove("copiado");
      }, 2200);
    }).catch(() => {
      // Se tudo falhar, abre prompt com o link para o usuário copiar manualmente
      prompt("Copie o link abaixo:", texto);
    });
  }

  // ── Botão copiar link dos filtros ─────────────────────────
  const btnCopiarFiltro    = document.getElementById("btnCopiarFiltro");
  const btnCopiarFiltroTxt = document.getElementById("btnCopiarFiltroTxt");
  if (btnCopiarFiltro) {
    btnCopiarFiltro.addEventListener("click", () => {
      copiarTexto(gerarUrlFiltros(), btnCopiarFiltro, btnCopiarFiltroTxt, "✓ Copiado!");
    });
  }

  init();
})();
