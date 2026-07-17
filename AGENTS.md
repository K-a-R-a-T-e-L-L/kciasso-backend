# KCIASSO backend instructions

Document placements reference one Document and one physical version file; never duplicate files or versions per placement. Removing a placement is not document deletion. Full document deletion must use storage quarantine and compensation around the database transaction.
Этот репозиторий является backend-частью KCIASSO.

Связанный frontend:

`D:\Desktop\dev\web\orders\kciasso-frontend`

Оба репозитория следует рассматривать как один логический проект.

Перед задачей прочитать:

`D:\Desktop\dev\web\orders\kciasso-backend\PROJECT_STATE.md`

Единственный отчёт находится в:

`D:\Desktop\dev\web\orders\kciasso-backend\отчёт.txt`

Не создавать `PROJECT_STATE.md` или `отчёт.txt` во frontend. После задачи обновлять `PROJECT_STATE.md` только если изменилось фактическое состояние проекта. Подробности последней задачи полностью записывать в канонический `отчёт.txt`.

Соблюдать глобальные правила управления процессами: останавливать только процессы, запущенные текущей задачей, и не выполнять глобальный `taskkill node.exe`.

Runtime document storage находится вне Git и frontend public; production требует persistent mount `/app/storage`. Не изменять generated Prisma/Kubb вручную.
