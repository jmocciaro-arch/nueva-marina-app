-- ============================================================================
-- 014_notifications_triggers.sql
-- Auto-generación de notificaciones (nm_notifications) para eventos clave
-- del sistema: reservas, facturas, retos, accesos, partidos, suscripciones.
--
-- Todos los triggers son AFTER INSERT/UPDATE y se ejecutan en el servidor,
-- por lo que funcionan incluso cuando la acción ocurre fuera del frontend
-- (ej. cron jobs, imports masivos, inserts desde el service_role).
-- ============================================================================

-- Helper: inserta una notificación in_app
CREATE OR REPLACE FUNCTION nm_notify(
  p_user_id uuid,
  p_club_id bigint,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO nm_notifications (club_id, user_id, type, channel, title, body, data, is_read, sent_at)
  VALUES (COALESCE(p_club_id, 1), p_user_id, p_type, 'in_app', p_title, p_body, p_data, false, now());
END;
$$;

-- ============================================================================
-- RESERVAS: notificar al crear/cancelar reserva
-- ============================================================================
CREATE OR REPLACE FUNCTION nm_trigger_booking_notify()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_body text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.booked_by IS NOT NULL THEN
    v_body := 'Pista ' || COALESCE(NEW.court_id::text, '?') ||
              ' el ' || to_char(NEW.date, 'DD/MM/YYYY') ||
              ' a las ' || substring(NEW.start_time::text, 1, 5);
    PERFORM nm_notify(
      NEW.booked_by, NEW.club_id, 'booking',
      'Reserva confirmada', v_body,
      jsonb_build_object('booking_id', NEW.id, 'status', NEW.status)
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status <> NEW.status AND NEW.status = 'cancelled' AND NEW.booked_by IS NOT NULL THEN
    PERFORM nm_notify(
      NEW.booked_by, NEW.club_id, 'booking',
      'Reserva cancelada',
      'Tu reserva del ' || to_char(NEW.date, 'DD/MM/YYYY') || ' fue cancelada',
      jsonb_build_object('booking_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_nm_booking_notify ON nm_bookings;
CREATE TRIGGER tr_nm_booking_notify
AFTER INSERT OR UPDATE ON nm_bookings
FOR EACH ROW EXECUTE FUNCTION nm_trigger_booking_notify();

-- ============================================================================
-- FACTURAS: notificar al emitir y al marcarla como vencida
-- ============================================================================
CREATE OR REPLACE FUNCTION nm_trigger_invoice_notify()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.user_id IS NOT NULL THEN
    PERFORM nm_notify(
      NEW.user_id, NEW.club_id, 'invoice',
      'Nueva factura ' || COALESCE(NEW.invoice_number, '#' || NEW.id),
      'Importe: €' || NEW.total::text || ' · Vence el ' || to_char(NEW.due_date, 'DD/MM/YYYY'),
      jsonb_build_object('invoice_id', NEW.id, 'total', NEW.total)
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status <> NEW.status AND NEW.status = 'paid' AND NEW.user_id IS NOT NULL THEN
    PERFORM nm_notify(
      NEW.user_id, NEW.club_id, 'invoice',
      'Factura pagada',
      'Confirmamos el pago de la factura ' || COALESCE(NEW.invoice_number, '#' || NEW.id),
      jsonb_build_object('invoice_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_nm_invoice_notify ON nm_invoices;
CREATE TRIGGER tr_nm_invoice_notify
AFTER INSERT OR UPDATE ON nm_invoices
FOR EACH ROW EXECUTE FUNCTION nm_trigger_invoice_notify();

-- ============================================================================
-- RETOS: notificar al unirse y al completar
-- ============================================================================
CREATE OR REPLACE FUNCTION nm_trigger_challenge_notify()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_name text;
  v_club bigint;
BEGIN
  SELECT name, club_id INTO v_name, v_club FROM nm_challenges WHERE id = NEW.challenge_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM nm_notify(
      NEW.user_id, v_club, 'challenge',
      'Te uniste al reto',
      COALESCE(v_name, 'Nuevo reto') || ' — ¡a por ello!',
      jsonb_build_object('challenge_id', NEW.challenge_id)
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.completed = false AND NEW.completed = true THEN
    PERFORM nm_notify(
      NEW.user_id, v_club, 'challenge',
      '¡Reto completado! 🏆',
      'Completaste: ' || COALESCE(v_name, 'el reto'),
      jsonb_build_object('challenge_id', NEW.challenge_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_nm_challenge_notify ON nm_challenge_participants;
CREATE TRIGGER tr_nm_challenge_notify
AFTER INSERT OR UPDATE ON nm_challenge_participants
FOR EACH ROW EXECUTE FUNCTION nm_trigger_challenge_notify();

-- ============================================================================
-- ACCESO DENEGADO: alerta al usuario si intentó entrar y fue rechazado
-- ============================================================================
CREATE OR REPLACE FUNCTION nm_trigger_access_denied_notify()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.granted = false AND NEW.user_id IS NOT NULL THEN
    PERFORM nm_notify(
      NEW.user_id, NEW.club_id, 'alert',
      'Acceso denegado',
      COALESCE(NEW.denial_reason, 'Tu credencial no pudo ser validada'),
      jsonb_build_object('access_log_id', NEW.id, 'credential_type', NEW.credential_type)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_nm_access_denied_notify ON nm_access_logs;
CREATE TRIGGER tr_nm_access_denied_notify
AFTER INSERT ON nm_access_logs
FOR EACH ROW EXECUTE FUNCTION nm_trigger_access_denied_notify();

-- ============================================================================
-- SUSCRIPCIONES: avisar cuando se activa, se cancela o renueva
-- ============================================================================
CREATE OR REPLACE FUNCTION nm_trigger_subscription_notify()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_plan_name text;
BEGIN
  SELECT name INTO v_plan_name FROM nm_subscription_plans WHERE id = NEW.plan_id;
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    PERFORM nm_notify(
      NEW.user_id, NEW.club_id, 'subscription',
      'Suscripción activada',
      'Tu plan "' || COALESCE(v_plan_name, 'activo') || '" ya está en vigor',
      jsonb_build_object('subscription_id', NEW.id)
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status <> NEW.status THEN
    IF NEW.status = 'cancelled' THEN
      PERFORM nm_notify(
        NEW.user_id, NEW.club_id, 'subscription',
        'Suscripción cancelada',
        'Tu plan fue cancelado. Si fue un error contactá con el club.',
        jsonb_build_object('subscription_id', NEW.id)
      );
    ELSIF NEW.status = 'past_due' THEN
      PERFORM nm_notify(
        NEW.user_id, NEW.club_id, 'alert',
        'Pago pendiente de suscripción',
        'Tu plan tiene un pago sin regularizar',
        jsonb_build_object('subscription_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_nm_subscription_notify ON nm_subscriptions;
CREATE TRIGGER tr_nm_subscription_notify
AFTER INSERT OR UPDATE ON nm_subscriptions
FOR EACH ROW EXECUTE FUNCTION nm_trigger_subscription_notify();

-- ============================================================================
-- COMUNIDAD: notificar al autor del post cuando recibe like o comentario
-- ============================================================================
CREATE OR REPLACE FUNCTION nm_trigger_post_like_notify()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_author uuid; v_club bigint; v_liker text;
BEGIN
  SELECT author_id, club_id INTO v_author, v_club FROM nm_posts WHERE id = NEW.post_id;
  IF v_author IS NULL OR v_author = NEW.user_id THEN RETURN NEW; END IF;
  SELECT full_name INTO v_liker FROM nm_users WHERE id = NEW.user_id;
  PERFORM nm_notify(
    v_author, v_club, 'message',
    'Nuevo like en tu post',
    COALESCE(v_liker, 'Alguien') || ' le dio like a tu publicación',
    jsonb_build_object('post_id', NEW.post_id, 'from_user', NEW.user_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_nm_post_like_notify ON nm_post_likes;
CREATE TRIGGER tr_nm_post_like_notify
AFTER INSERT ON nm_post_likes
FOR EACH ROW EXECUTE FUNCTION nm_trigger_post_like_notify();

CREATE OR REPLACE FUNCTION nm_trigger_post_comment_notify()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_author uuid; v_club bigint; v_commenter text;
BEGIN
  SELECT author_id, club_id INTO v_author, v_club FROM nm_posts WHERE id = NEW.post_id;
  IF v_author IS NULL OR v_author = NEW.author_id THEN RETURN NEW; END IF;
  SELECT full_name INTO v_commenter FROM nm_users WHERE id = NEW.author_id;
  PERFORM nm_notify(
    v_author, v_club, 'message',
    'Nuevo comentario en tu post',
    COALESCE(v_commenter, 'Alguien') || ': ' || left(COALESCE(NEW.content, ''), 80),
    jsonb_build_object('post_id', NEW.post_id, 'comment_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_nm_post_comment_notify ON nm_post_comments;
CREATE TRIGGER tr_nm_post_comment_notify
AFTER INSERT ON nm_post_comments
FOR EACH ROW EXECUTE FUNCTION nm_trigger_post_comment_notify();

-- ============================================================================
-- BADGES: notificar al ganar un badge
-- ============================================================================
CREATE OR REPLACE FUNCTION nm_trigger_badge_notify()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_name text; v_club bigint;
BEGIN
  SELECT name, club_id INTO v_name, v_club FROM nm_badges WHERE id = NEW.badge_id;
  PERFORM nm_notify(
    NEW.user_id, v_club, 'alert',
    '🏅 Nuevo logro',
    'Ganaste el badge: ' || COALESCE(v_name, 'uno nuevo'),
    jsonb_build_object('badge_id', NEW.badge_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_nm_badge_notify ON nm_user_badges;
CREATE TRIGGER tr_nm_badge_notify
AFTER INSERT ON nm_user_badges
FOR EACH ROW EXECUTE FUNCTION nm_trigger_badge_notify();

-- ============================================================================
-- PLAN DE ENTRENAMIENTO ASIGNADO
-- ============================================================================
CREATE OR REPLACE FUNCTION nm_trigger_training_assigned_notify()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_name text; v_club bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT name, club_id INTO v_name, v_club FROM nm_training_plans WHERE id = NEW.plan_id;
    PERFORM nm_notify(
      NEW.user_id, v_club, 'gym',
      'Nuevo plan de entrenamiento',
      'Te asignaron: ' || COALESCE(v_name, 'un plan'),
      jsonb_build_object('plan_id', NEW.plan_id, 'user_plan_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_nm_training_assigned_notify ON nm_user_training_plans;
CREATE TRIGGER tr_nm_training_assigned_notify
AFTER INSERT ON nm_user_training_plans
FOR EACH ROW EXECUTE FUNCTION nm_trigger_training_assigned_notify();

-- ============================================================================
-- Índice para acelerar el listado de notificaciones no leídas
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_nm_notifications_user_unread
  ON nm_notifications(user_id, is_read, sent_at DESC);

COMMENT ON FUNCTION nm_notify IS 'Helper para insertar notificaciones in_app. Usar desde triggers o APIs.';
