-- =============================================
-- 04_insert_system_message.sql
-- Funcao para inserir mensagem de sistema em um grupo
-- Executar no Supabase SQL Editor APOS os scripts 01, 02 e 03
-- =============================================

CREATE OR REPLACE FUNCTION public.insert_system_message(
    p_conversation_id UUID,
    p_content TEXT
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_conversation RECORD;
    v_message_id UUID;
BEGIN
    -- Verificar se a conversa existe
    SELECT * INTO v_conversation FROM public.conversations WHERE id = p_conversation_id;

    IF v_conversation IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Conversa nao encontrada.');
    END IF;

    -- Verificar se o chamador e o criador da conversa
    IF v_conversation.created_by IS NOT NULL AND v_conversation.created_by != auth.uid() THEN
        RETURN json_build_object('success', false, 'error', 'Sem permissao para inserir mensagem nesta conversa.');
    END IF;

    -- Inserir mensagem de sistema
    INSERT INTO public.messages (
        conversation_id,
        sender_id,
        sender_name,
        content,
        created_at
    )
    VALUES (
        p_conversation_id,
        auth.uid(),
        'Sistema',
        p_content,
        now()
    )
    RETURNING id INTO v_message_id;

    RETURN json_build_object('success', true, 'message_id', v_message_id);
END;
$$;

-- Apenas usuarios autenticados podem chamar esta funcao
GRANT EXECUTE ON FUNCTION public.insert_system_message(UUID, TEXT) TO authenticated;