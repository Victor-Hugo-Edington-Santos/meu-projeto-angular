-- =============================================
-- 03_create_rpcs.sql
-- Stored Procedures (RPCs) para o sistema de amizades e convites
-- Executar no Supabase SQL Editor APÓS os scripts 01 e 02
-- =============================================

-- =============================================
-- 1. search_users: Pesquisar usuários por username
-- =============================================
CREATE OR REPLACE FUNCTION public.search_users(p_query TEXT)
RETURNS TABLE (
    id UUID,
    username TEXT,
    avatar_url TEXT,
    friendship_status TEXT,
    friendship_id UUID,
    is_requester BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.username,
        p.avatar_url,
        f.status AS friendship_status,
        f.id AS friendship_id,
        (f.requester_id = auth.uid()) AS is_requester
    FROM public.profiles p
    LEFT JOIN public.friendships f ON (
        (f.requester_id = auth.uid() AND f.receiver_id = p.id)
        OR
        (f.receiver_id = auth.uid() AND f.requester_id = p.id)
    )
    WHERE p.id != auth.uid()
      AND p.is_active = true
      AND p.username ILIKE '%' || p_query || '%'
    ORDER BY p.username
    LIMIT 20;
END;
$$;

-- =============================================
-- 2. send_friend_request: Enviar solicitação de amizade
-- =============================================
CREATE OR REPLACE FUNCTION public.send_friend_request(p_receiver_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_existing RECORD;
    v_new_friendship RECORD;
BEGIN
    -- Validar: não pode adicionar a si mesmo
    IF p_receiver_id = auth.uid() THEN
        RETURN json_build_object('success', false, 'error', 'Não é possível adicionar a si mesmo.');
    END IF;

    -- Verificar amizade existente (em qualquer direção)
    SELECT * INTO v_existing FROM public.friendships
    WHERE (requester_id = auth.uid() AND receiver_id = p_receiver_id)
       OR (requester_id = p_receiver_id AND receiver_id = auth.uid());

    IF v_existing IS NOT NULL THEN
        IF v_existing.status = 'accepted' THEN
            RETURN json_build_object('success', false, 'error', 'Vocês já são amigos.');
        ELSIF v_existing.status = 'pending' THEN
            RETURN json_build_object('success', false, 'error', 'Solicitação já enviada.');
        ELSIF v_existing.status = 'blocked' THEN
            RETURN json_build_object('success', false, 'error', 'Não foi possível enviar solicitação.');
        ELSIF v_existing.status = 'rejected' THEN
            -- Se foi rejeitado anteriormente, permitir nova tentativa
            UPDATE public.friendships
            SET status = 'pending', requester_id = auth.uid(), receiver_id = p_receiver_id, updated_at = now()
            WHERE id = v_existing.id
            RETURNING * INTO v_new_friendship;
            RETURN json_build_object('success', true, 'friendship_id', v_new_friendship.id);
        END IF;
    END IF;

    -- Criar nova solicitação
    INSERT INTO public.friendships (requester_id, receiver_id, status)
    VALUES (auth.uid(), p_receiver_id, 'pending')
    RETURNING * INTO v_new_friendship;

    RETURN json_build_object('success', true, 'friendship_id', v_new_friendship.id);
END;
$$;

-- =============================================
-- 3. respond_friend_request: Aceitar ou recusar solicitação
-- =============================================
CREATE OR REPLACE FUNCTION public.respond_friend_request(p_friendship_id UUID, p_action TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_friendship RECORD;
    v_conversation_id UUID;
BEGIN
    -- Validar ação
    IF p_action NOT IN ('accepted', 'rejected') THEN
        RETURN json_build_object('success', false, 'error', 'Ação inválida.');
    END IF;

    -- Buscar solicitação
    SELECT * INTO v_friendship FROM public.friendships
    WHERE id = p_friendship_id AND receiver_id = auth.uid() AND status = 'pending';

    IF v_friendship IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Solicitação não encontrada.');
    END IF;

    -- Atualizar status
    UPDATE public.friendships
    SET status = p_action, updated_at = now()
    WHERE id = p_friendship_id;

    -- Se aceitou, criar conversa DM entre os dois
    IF p_action = 'accepted' THEN
        -- Verificar se já existe conversa DM entre eles
        SELECT cp1.conversation_id INTO v_conversation_id
        FROM public.conversation_participants cp1
        JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
        JOIN public.conversations c ON c.id = cp1.conversation_id
        WHERE cp1.user_id = v_friendship.requester_id
          AND cp2.user_id = v_friendship.receiver_id
          AND c.type = 'direct';

        IF v_conversation_id IS NULL THEN
            -- Criar nova conversa DM
            v_conversation_id := gen_random_uuid();

            INSERT INTO public.conversations (id, name, type, created_by, created_at)
            VALUES (v_conversation_id, 'DM', 'direct', auth.uid(), now());

            -- Adicionar ambos como participantes
            INSERT INTO public.conversation_participants (conversation_id, user_id, joined_at)
            VALUES
                (v_conversation_id, v_friendship.requester_id, now()),
                (v_conversation_id, v_friendship.receiver_id, now());
        END IF;

        RETURN json_build_object('success', true, 'conversation_id', v_conversation_id);
    END IF;

    RETURN json_build_object('success', true);
END;
$$;

-- =============================================
-- 4. get_friends: Listar amigos aceitos com conversa DM
-- =============================================
CREATE OR REPLACE FUNCTION public.get_friends()
RETURNS TABLE (
    friend_id UUID,
    username TEXT,
    avatar_url TEXT,
    conversation_id UUID,
    friendship_id UUID
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS friend_id,
        p.username,
        p.avatar_url,
        -- Buscar a conversa DM entre os dois
        (
            SELECT cp1.conversation_id
            FROM public.conversation_participants cp1
            JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
            JOIN public.conversations c ON c.id = cp1.conversation_id
            WHERE c.type = 'direct'
              AND cp1.user_id = auth.uid()
              AND cp2.user_id = p.id
            LIMIT 1
        ) AS conversation_id,
        f.id AS friendship_id
    FROM public.friendships f
    JOIN public.profiles p ON (
        CASE
            WHEN f.requester_id = auth.uid() THEN p.id = f.receiver_id
            ELSE p.id = f.requester_id
        END
    )
    WHERE f.status = 'accepted'
      AND (f.requester_id = auth.uid() OR f.receiver_id = auth.uid())
    ORDER BY p.username;
END;
$$;

-- =============================================
-- 5. get_pending_requests: Solicitações pendentes recebidas
-- =============================================
CREATE OR REPLACE FUNCTION public.get_pending_requests()
RETURNS TABLE (
    friendship_id UUID,
    requester_id UUID,
    username TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.id AS friendship_id,
        f.requester_id,
        p.username,
        p.avatar_url,
        f.created_at
    FROM public.friendships f
    JOIN public.profiles p ON p.id = f.requester_id
    WHERE f.receiver_id = auth.uid()
      AND f.status = 'pending'
    ORDER BY f.created_at DESC;
END;
$$;

-- =============================================
-- 6. add_friend_to_group: Adicionar amigo a um grupo
-- =============================================
CREATE OR REPLACE FUNCTION public.add_friend_to_group(p_friend_id UUID, p_group_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_group RECORD;
    v_is_friend BOOLEAN;
    v_already_member BOOLEAN;
BEGIN
    -- Verificar se o grupo existe e o chamador é o criador
    SELECT * INTO v_group FROM public.groups
    WHERE id = p_group_id;

    IF v_group IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Grupo não encontrado.');
    END IF;

    IF v_group.created_by != auth.uid() THEN
        RETURN json_build_object('success', false, 'error', 'Apenas o criador do grupo pode adicionar membros.');
    END IF;

    -- Verificar se realmente são amigos
    SELECT EXISTS (
        SELECT 1 FROM public.friendships
        WHERE status = 'accepted'
          AND ((requester_id = auth.uid() AND receiver_id = p_friend_id)
            OR (receiver_id = auth.uid() AND requester_id = p_friend_id))
    ) INTO v_is_friend;

    IF NOT v_is_friend THEN
        RETURN json_build_object('success', false, 'error', 'Esta pessoa não é seu amigo.');
    END IF;

    -- Verificar se já é membro
    SELECT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = p_group_id AND user_id = p_friend_id
    ) INTO v_already_member;

    IF v_already_member THEN
        RETURN json_build_object('success', false, 'error', 'Esta pessoa já é membro do grupo.');
    END IF;

    -- Adicionar ao grupo
    INSERT INTO public.group_members (group_id, user_id, joined_at)
    VALUES (p_group_id, p_friend_id, now());

    -- Adicionar à conversa do grupo
    INSERT INTO public.conversation_participants (conversation_id, user_id, joined_at)
    VALUES (p_group_id, p_friend_id, now())
    ON CONFLICT DO NOTHING;

    -- Incrementar contador de membros
    UPDATE public.groups SET members = members + 1 WHERE id = p_group_id;

    RETURN json_build_object('success', true, 'group_name', v_group.name);
END;
$$;

-- =============================================
-- 7. generate_group_invite: Gerar código de convite
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_group_invite(p_group_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_group RECORD;
    v_code TEXT;
    v_existing RECORD;
    v_invite RECORD;
BEGIN
    -- Verificar se o grupo existe e o chamador é o criador
    SELECT * INTO v_group FROM public.groups WHERE id = p_group_id;

    IF v_group IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Grupo não encontrado.');
    END IF;

    IF v_group.created_by != auth.uid() THEN
        RETURN json_build_object('success', false, 'error', 'Apenas o criador do grupo pode gerar convites.');
    END IF;

    -- Verificar se já existe um convite ativo
    SELECT * INTO v_existing FROM public.group_invites
    WHERE group_id = p_group_id AND active = true AND expires_at > now()
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
        RETURN json_build_object('success', true, 'code', v_existing.code, 'expires_at', v_existing.expires_at);
    END IF;

    -- Desativar convites antigos
    UPDATE public.group_invites SET active = false WHERE group_id = p_group_id;

    -- Gerar código numérico de 5 dígitos único
    LOOP
        v_code := lpad(floor(random() * 100000)::text, 5, '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.group_invites WHERE code = v_code AND active = true);
    END LOOP;

    -- Inserir novo convite
    INSERT INTO public.group_invites (group_id, code, created_by, active, expires_at)
    VALUES (p_group_id, v_code, auth.uid(), true, now() + interval '7 days')
    RETURNING * INTO v_invite;

    RETURN json_build_object('success', true, 'code', v_invite.code, 'expires_at', v_invite.expires_at);
END;
$$;

-- =============================================
-- 8. use_invite_code: Usar código de convite para entrar no grupo
-- =============================================
CREATE OR REPLACE FUNCTION public.use_invite_code(p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_invite RECORD;
    v_already_member BOOLEAN;
BEGIN
    -- Buscar convite ativo pelo código
    SELECT gi.*, g.name AS group_name
    INTO v_invite
    FROM public.group_invites gi
    JOIN public.groups g ON g.id = gi.group_id
    WHERE gi.code = p_code AND gi.active = true AND gi.expires_at > now();

    IF v_invite IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Código inválido ou expirado.');
    END IF;

    -- Verificar se já é membro
    SELECT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = v_invite.group_id AND user_id = auth.uid()
    ) INTO v_already_member;

    IF v_already_member THEN
        RETURN json_build_object('success', false, 'error', 'Você já é membro deste grupo.');
    END IF;

    -- Adicionar ao grupo
    INSERT INTO public.group_members (group_id, user_id, joined_at)
    VALUES (v_invite.group_id, auth.uid(), now());

    -- Adicionar à conversa do grupo
    INSERT INTO public.conversation_participants (conversation_id, user_id, joined_at)
    VALUES (v_invite.group_id, auth.uid(), now())
    ON CONFLICT DO NOTHING;

    -- Incrementar contador de membros
    UPDATE public.groups SET members = members + 1 WHERE id = v_invite.group_id;

    RETURN json_build_object(
        'success', true,
        'group_id', v_invite.group_id,
        'group_name', v_invite.group_name
    );
END;
$$;
