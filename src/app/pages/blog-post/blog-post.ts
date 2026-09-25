import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-blog-post',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './blog-post.css',
  templateUrl: './blog-post.html',
})
export class BlogPost implements AfterViewInit, OnDestroy {
  // --- Barra de progresso de leitura no topo ---
  @ViewChild('readingProgress') readingProgress!: ElementRef<HTMLElement>;
  // --- Lista e campo do formulário de comentários ---
  @ViewChild('listaComentarios') listaComentarios!: ElementRef<HTMLElement>;
  @ViewChild('comentarioTexto') comentarioTexto!: ElementRef<HTMLTextAreaElement>;

  constructor(private readonly auth: AuthService) {}

  // --- Atualiza a largura conforme % rolada da página ---
  private onWindowScroll = () => {
    if (!this.readingProgress) return;
    const doc = document.documentElement.scrollHeight - window.innerHeight;
    const pct = doc > 0 ? (window.scrollY / doc) * 100 : 0;
    this.readingProgress.nativeElement.style.width = Math.min(pct, 100) + '%';
    // TODO SUPABASE: persistir progresso em currentReading/favorites
    // (reading-state.js original só guardava em localStorage).
  };

  ngAfterViewInit(): void {
    // --- Liga o progresso de leitura ---
    if (!this.readingProgress) return;
    window.addEventListener('scroll', this.onWindowScroll, { passive: true });
    this.onWindowScroll();
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onWindowScroll);
  }

  // --- Publica comentário (MOCK local, sem persistência) ---
  // TODO SUPABASE: trocar por insert na tabela de comentários (ex.: sb.from('comentarios')
  // .insert({ post_slug: 'post-masking', autor_id, texto })) e recarregar a lista.
  publicarComentario(): void {
    const ta = this.comentarioTexto?.nativeElement;
    const lista = this.listaComentarios?.nativeElement;
    const texto = ta?.value.trim() ?? '';
    if (!texto || !ta || !lista) return; // vazio: ignora

    const usuario = this.auth.getUsuarioAtual();
    const nome = usuario?.nome ?? 'Você';
    const avatar = usuario?.avatarUrl ?? 'img/foto-padrão.jpg';

    const item = document.createElement('div');
    item.className = 'item-comentario';
    const img = document.createElement('img');
    img.src = avatar;
    img.alt = nome;
    img.className = 'sidebarAvatar';
    const corpo = document.createElement('div');
    corpo.className = 'conteudo-comentario';
    corpo.innerHTML = `
      <div class="cabecalho-comentario">
        <strong class="nome-autor"></strong>
        <span class="tempo-comentario">agora mesmo</span>
      </div>
      <button type="button" class="btn-responder">Responder</button>`;
    corpo.querySelector('.nome-autor')!.textContent = nome;
    const p = document.createElement('p');
    p.className = 'texto-comentario';
    p.textContent = texto; // textContent escapa HTML (sem XSS)
    corpo.insertBefore(p, corpo.querySelector('.btn-responder'));
    item.appendChild(img);
    item.appendChild(corpo);
    lista.appendChild(item);

    ta.value = '';
    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
