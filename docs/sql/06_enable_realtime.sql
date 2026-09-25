-- =============================================
-- 06_enable_realtime.sql
-- Habilita o Realtime (tempo real) para as tabelas de mensagens, posts e comentários no Supabase.
-- Execute este script no SQL Editor do seu painel do Supabase.
-- =============================================

-- 1. Garante que a publicação "supabase_realtime" existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- 2. Adiciona as tabelas com verificação de segurança para não gerar erro caso já existam
DO $$
BEGIN
    -- public.messages (chat)
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_rel pr
        JOIN pg_class c ON c.oid = pr.prrelid
        JOIN pg_publication p ON p.oid = pr.prpubid
        WHERE p.pubname = 'supabase_realtime' AND c.relname = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
        RAISE NOTICE 'Mensagens adicionadas ao Realtime.';
    END IF;

    -- public.posts (fórum)
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_rel pr
        JOIN pg_class c ON c.oid = pr.prrelid
        JOIN pg_publication p ON p.oid = pr.prpubid
        WHERE p.pubname = 'supabase_realtime' AND c.relname = 'posts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
        RAISE NOTICE 'Posts adicionados ao Realtime.';
    END IF;

    -- public.comments (comentários)
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_rel pr
        JOIN pg_class c ON c.oid = pr.prrelid
        JOIN pg_publication p ON p.oid = pr.prpubid
        WHERE p.pubname = 'supabase_realtime' AND c.relname = 'comments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
        RAISE NOTICE 'Comments adicionados ao Realtime.';
    END IF;

    -- public.group_invites (convites)
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_rel pr
        JOIN pg_class c ON c.oid = pr.prrelid
        JOIN pg_publication p ON p.oid = pr.prpubid
        WHERE p.pubname = 'supabase_realtime' AND c.relname = 'group_invites'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.group_invites;
        RAISE NOTICE 'Group Invites adicionados ao Realtime.';
    END IF;

    -- public.friendships (amizades)
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_rel pr
        JOIN pg_class c ON c.oid = pr.prrelid
        JOIN pg_publication p ON p.oid = pr.prpubid
        WHERE p.pubname = 'supabase_realtime' AND c.relname = 'friendships'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
        RAISE NOTICE 'Friendships adicionadas ao Realtime.';
    END IF;
END $$;