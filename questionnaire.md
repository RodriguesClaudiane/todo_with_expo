# Mobile App Reverse-Engineering Questions

Answer the following questions based on the code generated during the exercise.

You may use the coding agent to help investigate the project, but you must inspect the source code and verify the answers yourself.

Whenever possible, mention the relevant files, classes, functions, or components.

---
Dupla: Claudiane Rodrigues e Joyce Kelly
---

## 1. Project Structure

What are the main parts of the project, and where can you find:

- UI/screens:
  As telas ficam em src/app/
  sendo: index.tsx a lista de tarefas, task/[id].tsx a tela de criação, edição e detalhes e categories.tsx o gerenciamento das categorias.
  Os componentes reutilizáveis criados ficam em src/components/

- data models:
  São definidos no arquivo src/db/models e define os tipos: Task, Category, TaskWithCategory, TaskInput, os tipos de filtro, ValidationError e os limites de tamanho.

- SQLite/database code:
  src/db/schema.ts define o nome do banco, cria as categorias padrão e define suas respectivas cores, roda as migrações, ativa as chaves estrangeiras.

src/db/tasks.ts e src/db/categories.ts executam as operações de CRUD(criar, ler, atualizar, deletar) e validação dos dados.

- navigation:
  Para a navegação foi utilizado o Expo Router, a partir dos arquivos em src/app/.

src/app/layout.tsx monta a stack principal com as três telas da aplicação

- notification code?
  src/services/notifications.ts cuida das permissões, do canal android (notification channel), do handler que vai mostrar as notificações quando o app estiver aberto e agendamento/cancelamento de lembretes.

---

## 2. Architecture and State

How is application state managed?

Explain how the UI is updated after an operation such as:

- creating a task;
- editing a task;
- marking a task as completed.

Does the project use any recognizable architectural pattern or state-management approach?

A persistência dos dados é feita exclusivamente pelo SQLite: tarefas, categorias e id de notificação.
O gerenciamento de estados é feito através do uso de useState, que recebe cópias desses dados e os busca novamente quando ocorrem mudanças.

---

## 3. SQLite Persistence

How is SQLite used in the application?

Identify:

- where the database is created:
  O arquivo todo.db é criado se não existir, ou aberto caso contrário e a verificação da versão o banco está. Se a versão for 0 as tabelas e os indices são criados e as categorias padrão são inseridase a partir daí as próximas migrações são inseridas de forma a não perder os dados do usuário.

- how tasks and categories are stored:
  As tabelas de tabelas são criadas em schema.ts(linhas 42-63) de acordo com como as colunas foram definidas ali.

- where create, read, update, and delete operations are implemented.
  As operações estão sendo implementadas em src/db/tasks.ts(tarefas) e src/db/categories.ts(categorias).

---

## 4. Follow One Operation

Trace what happens when the user creates a new task.

Start from pressing **Save** and follow the execution until:

1. the task is stored in SQLite;
2. the task appears in the task list;
3. a notification is scheduled, if a due date exists.

Describe the main functions/components involved.

Na tela task/[id].tsx, ao clicar no botão save, a função save() é ativada, verifica se o título foi preenchido e chama o serviço saveTask() (src/services/task-service.ts).

saveTask() chama creatTask() (src/db/tasks.ts), que valida os dados e faz o insert na tabela tasks. Após salvar saveTask() chama syncReminder(). Se a tarefa tem uma data de vencimento no futuro e não foi marcada como concluída ela pede permissão ao usuário e ageta o lembrete com scheduleTaskReminder() (src/services/notifications.ts) e então, o id da notificação é salvo na tarefa.

Voltando para save(), o feedback é dado e se a tarefa não puder ser agendada aparece um alerta na tela. Se correr tudo bem router.back() volta para a lista e quando ela é carregada novamente o hook useTasks busca novamente as tarefas no banco (listTasks()) para atualizar a lista com a nova tarefa.

---

## 5. Navigation

How does navigation between screens work?

In particular:

- how does the app navigate from the task list to the task editor?
- when editing a task, what information is passed between screens?

For example: task ID, full object, shared state, or another approach.

A navegação usa o Expo Router: cada arquivo em src/app/ é uma tela, e o \_layout.tsx organiza as três telas em uma Stack. Na lista (index.tsx), a função openTask() chama router.push('/task/[id]'), passando o id da tarefa (ao tocar numa tarefa) ou 'new' (ao tocar em "New task").

Entre as telas é passado apenas o ID da tarefa, como parâmetro da rota. O editor lê o id com useLocalSearchParams() e busca a tarefa no SQLite com getTask(). Ao salvar, router.back() volta para a lista, que recarrega os dados do banco quando ganha foco (useFocusEffect no hook useTasks).

---

## 6. Notifications

How are task reminders implemented?

Explain:

- how a notification is scheduled;
- how it is associated with a task;
- what happens when the due date changes;
- what happens when the task is completed or deleted.

Os lembretes são notificações locais agendadas com expo-notifications. Em src/services/notifications.ts, scheduleTaskReminder() agenda a notificação para a data de vencimento da tarefa, desde que a data esteja no futuro, a tarefa esteja pendente e o usuário tenha dado permissão (ensureNotificationPermission()).

O id retornado pelo agendamento é salvo na coluna notification_id da tabela tasks. É assim que a notificação fica ligada à tarefa.

Toda alteração passa por syncReminder() (src/services/task-service.ts): ela cancela o lembrete anterior e agenda um novo se ainda for necessário. Por isso, ao mudar a data, o lembrete antigo é trocado por um novo. Ao concluir a tarefa, o lembrete é cancelado e não é recriado. Ao excluir, removeTask() cancela a notificação antes de apagar a tarefa.

---

## 7. Agent Decisions

Identify at least **two important decisions made by the coding agent that were not explicitly specified in the assignment**.

Examples:

- architecture;
- libraries;
- state-management strategy;
- navigation approach;
- SQLite abstraction;
- project structure.

For each one, explain what the agent chose.

1. O agente usou expo-sqlite com SQL puro, organizado em módulos de repositório (src/db/tasks.ts e src/db/categories.ts), sem ORM. Ele considerou o Drizzle ORM, mas descartou por adicionar complexidade desnecessária para um app com apenas duas tabelas.
2. O agente não usou nenhuma biblioteca de estado global. O SQLite é a única fonte de dados, e os hooks useTasks e useCategories recarregam os dados sempre que a tela ganha foco (useFocusEffect).
3. Criou src/services/task-service.ts com a função syncReminder(), que concentra toda a lógica de cancelar e reagendar notificações.
4. Adicionou o filtro "Uncategorized" e cores nas categorias.

---

## 8. BUILD_LOG Analysis

Using `BUILD_LOG.md`, identify:

- one problem or bug encountered during development;
- how the agent attempted to solve it;
- whether the first solution worked;
- what was eventually done.

Then answer:

Problema: A notificação não era disparada quando o tempo da tarefa era atingido.

Primeira tentativa de solução: na Entry 8, o agente percebeu um atraso de cerca de 1 minuto, mas tratou isso como uma limitação normal do Android e só documentou. Não funcionou: o teste tinha sido feito com o app aberto e não
mostrou o problema real.

Solução final: analisando os logs, o agente descobriu que o alarme era inexato (sem permissão de alarme exato) e que o sistema do celular (MIUI) adiava esses alarmes com o app em segundo plano. Ele adicionou a permissão USE_EXACT_ALARM no app.json, gerou um novo APK e confirmou que a notificação passou a chegar no horário certo.

**What did the build log help you understand that would have been harder to discover by looking only at the final code?**
A questão do erro nas notificações.
