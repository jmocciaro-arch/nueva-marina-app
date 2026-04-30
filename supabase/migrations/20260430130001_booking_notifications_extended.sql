-- ============================================================================
-- 20260430130001_booking_notifications_extended.sql
-- Amplía el trigger de notificaciones de reservas para cubrir más eventos:
--
--   • INSERT con booked_by         → "Reserva confirmada" (existía)
--   • UPDATE pending → confirmed   → "Reserva confirmada"            [nuevo]
--   • UPDATE → cancelled           → "Reserva cancelada" (existía)
--   • UPDATE de fecha/hora/pista   → "Reserva modificada"            [nuevo]
--
-- Idempotente: se puede correr varias veces, reemplaza la función y el trigger.
-- ============================================================================

CREATE OR REPLACE FUNCTION nm_trigger_booking_notify()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_body text;
  v_court_name text;
  v_changed boolean;
BEGIN
  -- Helper local: nombre de la pista para el body de la notificación
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT name INTO v_court_name FROM nm_courts WHERE id = NEW.court_id;
  END IF;

  -- ───── INSERT: nueva reserva ─────────────────────────────────────────────
  IF TG_OP = 'INSERT' AND NEW.booked_by IS NOT NULL THEN
    v_body := COALESCE(v_court_name, 'Pista ' || NEW.court_id::text) ||
              ' el ' || to_char(NEW.date, 'DD/MM/YYYY') ||
              ' a las ' || substring(NEW.start_time::text, 1, 5);
    PERFORM nm_notify(
      NEW.booked_by, NEW.club_id, 'booking',
      CASE WHEN NEW.status = 'pending' THEN 'Reserva pendiente de confirmación'
           ELSE 'Reserva confirmada' END,
      v_body,
      jsonb_build_object('booking_id', NEW.id, 'status', NEW.status, 'event', 'created')
    );

  -- ───── UPDATE: cambios sobre reserva existente ──────────────────────────
  ELSIF TG_OP = 'UPDATE' AND NEW.booked_by IS NOT NULL THEN

    -- 1) Cancelación (cualquier estado → cancelled)
    IF OLD.status <> NEW.status AND NEW.status = 'cancelled' THEN
      PERFORM nm_notify(
        NEW.booked_by, NEW.club_id, 'booking',
        'Reserva cancelada',
        'Tu reserva del ' || to_char(NEW.date, 'DD/MM/YYYY') ||
        ' a las ' || substring(NEW.start_time::text, 1, 5) || ' fue cancelada',
        jsonb_build_object('booking_id', NEW.id, 'event', 'cancelled')
      );

    -- 2) Confirmación (pending → confirmed)
    ELSIF OLD.status <> NEW.status AND NEW.status = 'confirmed' AND OLD.status = 'pending' THEN
      v_body := COALESCE(v_court_name, 'Pista ' || NEW.court_id::text) ||
                ' el ' || to_char(NEW.date, 'DD/MM/YYYY') ||
                ' a las ' || substring(NEW.start_time::text, 1, 5);
      PERFORM nm_notify(
        NEW.booked_by, NEW.club_id, 'booking',
        'Reserva confirmada',
        v_body,
        jsonb_build_object('booking_id', NEW.id, 'event', 'confirmed')
      );

    -- 3) Modificación de fecha / hora / pista (sin cancelar)
    ELSIF NEW.status <> 'cancelled' THEN
      v_changed := (
        OLD.date <> NEW.date OR
        OLD.start_time <> NEW.start_time OR
        OLD.end_time <> NEW.end_time OR
        OLD.court_id <> NEW.court_id
      );
      IF v_changed THEN
        PERFORM nm_notify(
          NEW.booked_by, NEW.club_id, 'booking',
          'Reserva modificada',
          'Nueva: ' || COALESCE(v_court_name, 'Pista ' || NEW.court_id::text) ||
          ' el ' || to_char(NEW.date, 'DD/MM/YYYY') ||
          ' a las ' || substring(NEW.start_time::text, 1, 5),
          jsonb_build_object(
            'booking_id', NEW.id, 'event', 'updated',
            'old', jsonb_build_object('date', OLD.date, 'start_time', OLD.start_time, 'court_id', OLD.court_id),
            'new', jsonb_build_object('date', NEW.date, 'start_time', NEW.start_time, 'court_id', NEW.court_id)
          )
        );
      END IF;
    END IF;

    -- 4) Cambio de titular: avisar al nuevo titular si pasó de NULL/otro a este
    IF (OLD.booked_by IS NULL OR OLD.booked_by <> NEW.booked_by) AND NEW.status <> 'cancelled' THEN
      v_body := COALESCE(v_court_name, 'Pista ' || NEW.court_id::text) ||
                ' el ' || to_char(NEW.date, 'DD/MM/YYYY') ||
                ' a las ' || substring(NEW.start_time::text, 1, 5);
      PERFORM nm_notify(
        NEW.booked_by, NEW.club_id, 'booking',
        'Te asignaron una reserva',
        v_body,
        jsonb_build_object('booking_id', NEW.id, 'event', 'assigned')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_nm_booking_notify ON nm_bookings;
CREATE TRIGGER tr_nm_booking_notify
AFTER INSERT OR UPDATE ON nm_bookings
FOR EACH ROW EXECUTE FUNCTION nm_trigger_booking_notify();
