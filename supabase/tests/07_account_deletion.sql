-- In-app account deletion: the person's own digital codes stop, their code no longer signs in, others untouched.
begin;

insert into public.credentials (edition_id, participant_id, kind, token_hash)
values (tests.id('e1'), tests.id('p3'), 'digital', sha256('fixture-digital-p3')), (tests.id('e1'), tests.id('p3'), 'card', sha256('fixture-card-p3'));
create temp table c as select id, access_code from public.participants;
grant select on c to authenticated, anon;

select tests.anon();
select tests.throws($$select public.delete_my_account()$$, 'anon cannot delete', '42501');
reset role;

select tests.login('a5');
select public.delete_my_account();
reset role;

select tests.ok((select account_deleted_at is not null from public.participants where id = tests.id('p3')), 'own participant marked deleted');
select tests.eq((select count(*) from public.participants where account_deleted_at is not null), 1::bigint, 'nobody else marked');
select tests.ok((select revoked_at is not null from public.credentials where participant_id = tests.id('p3') and kind = 'digital'), 'digital code revoked');
select tests.ok((select revoked_at is null from public.credentials where participant_id = tests.id('p3') and kind = 'card'), 'printed badge still valid (organisers decide)');
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p3')), null, '10.9.0.1') ->> 'ok', 'false', 'deleted person cannot sign in again with the code');

-- the Auth user then goes; the registration stays, unlinked
delete from auth.users where id = tests.id('a5');
select tests.ok((select user_id is null from public.participants where id = tests.id('p3')), 'participant unlinked when the Auth user is deleted');

-- an organiser restores access
update public.participants set account_deleted_at = null where id = tests.id('p3');
select tests.eq(public.code_login_check((select access_code from c where id = tests.id('p3')), null, '10.9.0.2') ->> 'ok', 'true', 'access restored by organiser');

rollback;
