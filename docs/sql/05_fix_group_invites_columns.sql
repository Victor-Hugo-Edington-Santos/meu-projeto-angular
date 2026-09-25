-- =============================================
-- 05_fix_group_invites_columns.sql
-- Corrige colunas faltantes na tabela group_invites
-- Execute no Supabase SQL Editor
-- =============================================

-- Adicionar coluna "active" se nao existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'group_invites'
          AND column_name = 'active'
    ) THEN
        ALTER TABLE public.group_invites ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;
        RAISE NOTICE 'Coluna active adicionada.';
    ELSE
        RAISE NOTICE 'Coluna active ja existe.';
    END IF;
END $$;

-- Adicionar coluna "code" se nao existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'group_invites'
          AND column_name = 'code'
    ) THEN
        ALTER TABLE public.group_invites ADD COLUMN code TEXT NOT NULL DEFAULT '';
        ALTER TABLE public.group_invites ADD CONSTRAINT group_invites_code_unique UNIQUE (code);
        RAISE NOTICE 'Coluna code adicionada.';
    ELSE
        RAISE NOTICE 'Coluna code ja existe.';
    END IF;
END $$;

-- Adicionar coluna "created_by" se nao existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'group_invites'
          AND column_name = 'created_by'
    ) THEN
        ALTER TABLE public.group_invites ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Coluna created_by adicionada.';
    ELSE
        RAISE NOTICE 'Coluna created_by ja existe.';
    END IF;
END $$;

-- Adicionar coluna "expires_at" se nao existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'group_invites'
          AND column_name = 'expires_at'
    ) THEN
        ALTER TABLE public.group_invites ADD COLUMN expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days');
        RAISE NOTICE 'Coluna expires_at adicionada.';
    ELSE
        RAISE NOTICE 'Coluna expires_at ja existe.';
    END IF;
END $$;

-- Garantir que o RLS esta ativo
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

-- Recriar politicas (ignorar erro se ja existirem)
DO $$
BEGIN
    BEGIN
        CREATE POLICY "group_invites_select_all"
            ON public.group_invites FOR SELECT
            USING (true);
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'Policy select ja existe.';
    END;

    BEGIN
        CREATE POLICY "group_invites_insert_creator"
            ON public.group_invites FOR INSERT
            WITH CHECK (auth.uid() = created_by);
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'Policy insert ja existe.';
    END;

    BEGIN
        CREATE POLICY "group_invites_update_creator"
            ON public.group_invites FOR UPDATE
            USING (auth.uid() = created_by);
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'Policy update ja existe.';
    END;
END $$;

-- Confirmar estrutura final
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'group_invites'
ORDER BY ordinal_position;