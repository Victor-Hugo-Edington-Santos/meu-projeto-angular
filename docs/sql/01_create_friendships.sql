-- =============================================
-- 01_create_friendships.sql
-- Tabela de amizades entre usuários
-- Executar no Supabase SQL Editor
-- =============================================

-- Criar tabela de amizades
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Impedir auto-amizade
    CONSTRAINT no_self_friendship CHECK (requester_id != receiver_id),

    -- Impedir duplicatas (A→B e B→A contam como a mesma relação)
    CONSTRAINT unique_friendship UNIQUE (requester_id, receiver_id)
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_receiver ON public.friendships(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON public.friendships(status);

-- Habilitar RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Política: usuário só vê amizades onde é parte envolvida
CREATE POLICY "Users can view own friendships"
    ON public.friendships FOR SELECT
    USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- Política: só pode criar solicitação como requester
CREATE POLICY "Users can send friend requests"
    ON public.friendships FOR INSERT
    WITH CHECK (auth.uid() = requester_id AND status = 'pending');

-- Política: receiver pode aceitar/recusar; ambos podem bloquear
CREATE POLICY "Users can update friendships"
    ON public.friendships FOR UPDATE
    USING (auth.uid() = receiver_id OR auth.uid() = requester_id)
    WITH CHECK (
        -- Receiver pode aceitar ou recusar
        (auth.uid() = receiver_id AND status IN ('accepted', 'rejected', 'blocked'))
        OR
        -- Qualquer parte pode bloquear
        (auth.uid() = requester_id AND status = 'blocked')
    );

-- Política: ambos podem desfazer amizade
CREATE POLICY "Users can delete friendships"
    ON public.friendships FOR DELETE
    USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_friendships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER friendships_updated_at
    BEFORE UPDATE ON public.friendships
    FOR EACH ROW
    EXECUTE FUNCTION update_friendships_updated_at();
