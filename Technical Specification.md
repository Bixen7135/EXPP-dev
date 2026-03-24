**Technical Specification for the Development of the First Version of Exam Preparation Platform (EXPP)**

Revision 1.0

**Document Type** Technical specification and requirements specification for the implementation of the first version

**Basis** Functional description of the first version of the EXPP prototype and current project documentation

**Scope** School

# 1 General Provisions

This technical specification defines the composition, boundaries, requirements, and acceptance criteria for the first version of the Exam Preparation Platform (EXPP) system. The document is intended for the design, development, testing, and acceptance team and records exactly what must be implemented in the first version of the product, how its functions must operate, and by what indicators the result can be considered ready for launch.

The first version of the system must demonstrate the viability of the product's core logic. The system must guide the user through a complete instructional cycle, from uploading source materials and controlled assignment generation to assigning the assignment to a student, completion, assessment, receiving the result, and viewing basic analytics.

This document describes only the functional and non-functional requirements for the system and the principles of its operation. The document intentionally does not include the data model, database table descriptions, lists of entities, attributes, relationships, or other elements of the internal data storage schema.

## 1.1. Objective of the First Version

The objective of the first version is to implement a minimally sufficient yet complete school system that supports one closed and operational instructional cycle. The teacher must be able to prepare an assignment based on their own materials, assign it to students with the required AI-based assistance access policy, then receive submissions, assess them, and see the result. The student must be able to receive the assignment, complete it within the platform, submit the result, and receive a grade, feedback, and a post-completion error review if that mode is allowed.

## 1.2. Target Deployment Scope

The first version is school-oriented and is implemented primarily as a school organizational scope. Only three roles are permitted in the first version. Student, teacher, and administrator. The teacher is considered only as a school instructional participant, not as a universal instructor for any type of organization. The administrator is present only to the minimally necessary extent and is needed for user management and basic system settings.

The functionality of the first version must not expand into a full multi organization educational platform. All decisions made during implementation must support the school scenario as the primary and mandatory one.

## 1.3. Scope of Responsibility of the Document

This technical specification establishes a mandatory set of requirements. The contractor may propose better technical solutions, interface details, or architectural mechanisms if they do not weaken the stated requirements, do not expand the first version to an uncontrolled scale, and do not introduce dependence on the data storage model into the document text itself.

# 2 Regulatory References and Rules for Applying Standards

The structure of requirements and quality criteria in this document are based on international standards for systems and software engineering, security, architecture description, interface design, and software interface specification. These standards are used as a methodological framework and quality benchmark. This document is not a statement of certification under the listed standards, but the requirements are formulated so that the project can be implemented and verified in accordance with their principles.

## 2.1. Requirements for Applying Standards

**STD-01.** The structure and wording of requirements must support verifiability, unambiguity, traceability, and suitability for acceptance.

**STD-02.** Architectural decisions must be described through separate views for functional logic, interfaces, security, operations, and component interactions.

**STD-03.** The implementation process must provide for planning, design, development, testing, acceptance, release, and maintenance as distinct lifecycle stages.

**STD-04.** Interfaces and user scenarios must be designed according to human centered design principles, with validation of clarity, predictability, and distinguishability of critical actions.

**STD-05.** Technical protection measures must be verified not only declaratively but also through formalizable validation and security testing criteria.

**STD-06.** External system interfaces must be described with machine-readable specifications. OpenAPI shall be used for synchronous HTTP interfaces, the GraphQL specification shall be used for GraphQL schemas, and AsyncAPI shall be used for event-driven and message oriented interfaces.

## 2.2. Regulatory References

- ISO/IEC/IEEE 29148 as a reference for requirements engineering, requirements structure, and mandatory information elements.
- ISO/IEC/IEEE 42010 as a reference for architecture description through views, stakeholders, and significant concerns.
- ISO/IEC/IEEE 12207 and ISO/IEC/IEEE 15288 as a reference for the software and systems development lifecycle.
- ISO 9241, primarily the principles of human centered design, as a reference for interfaces and user work.
- OWASP ASVS and OWASP Top 10 as a reference for requirements for verifiable web application security.
- OpenAPI, GraphQL, and AsyncAPI as the mandatory basis for formal software interface descriptions where they are applicable.

# 3 System Purpose and Boundaries of the First Version

Version 1 of EXPP is created as a school learning system with controlled assignment generation and controlled use of artificial intelligence. The system must not behave like a conventional conversational assistant or like an abstract platform for any educational scenario. Its purpose is to support a precise, traceable, and verifiable instructional process in which the teacher retains pedagogical control and the student works within the system without compromising academic integrity.

## 3.1. Functions Included in the First Version

- User authentication, system sign in, basic role separation, and separation of student, teacher, and administrator interfaces.
- Upload of instructional materials by the teacher and use of those materials as a source for controlled assignment generation.
- Generation of individual assignments and worksheets based on user materials and specified instructional constraints.
- Editing of an assignment or worksheet before publication and assignment.
- Minimally sufficient versioning of instructional content.
- Assignment of an assignment to one or more students with a specified deadline, assignment status, and AI-based assistance mode.
- A student assignment completion environment with draft saving and submission of the final attempt.
- Basic assessment including automatic checking where possible and manual review by the teacher.
- Basic analytics for the teacher and the student.
- A basic audit log and traceability of key actions.
- A minimal administrative scope for managing users, system objects, and basic platform settings.

## 3.2. Functions Deliberately Excluded from the First Version

- A full multi organization and multi context model with multiple isolated organizational scopes for a single user.
- Full featured school classes, grade levels, subgroups, complex group assignments, and team learning scenarios.
- Voluntary student learning groups for independent practice.
- A full-featured messenger, voice and video communication, videoconferencing, and contextual discussions.
- Calendar, scheduling, task system, and integrated time planning.
- Advanced analytics, personalized learning paths, skill graphs, adaptive routes, and metacognitive tools.
- Rankings, leaderboards, competitive modes, and gamification.
- Material exchange between organizations, template publication, a materials showcase, and a knowledge sharing layer.
- A full autonomous offline mode and synchronization under unstable internet conditions.
- Complex visualization, diagram generation through code, and visual builders.

# 4 Overall Functional Logic of the System

The first version of the system is built around one closed instructional cycle. This cycle consists of material preparation, assignment generation, pedagogical editing, assignment distribution, student completion, assessment, result publication, and receipt of basic analytics. All main system modules must operate as parts of one connected sequence, not as a set of independent functions.

## 4.1. End to End Operating Logic

The teacher starts by uploading their own materials. After that, the teacher sets instructional constraints and launches controlled generation of an assignment or worksheet. The system uses the uploaded materials, generation parameters, and instructional constraints as context for producing the result. The resulting output is not considered automatically ready for use. The teacher must be able to review it, make changes, and save the final version.

After the final version is fixed, the teacher assigns the assignment to one or more students, sets a deadline, defines the assignment status, and sets the permitted AI-based assistance mode. The student receives the assignment within their workspace, sees the instructions, deadline, assignment status, and active restrictions. The student then completes the work, can save intermediate progress, and submits the final attempt.

After the attempt is submitted, the system transfers the work into the assessment workflow. Automatic checking is applied only where it is permissible for the assignment type and response format. The teacher completes the review, leaves a comment, and publishes the result. After the result is published, the teacher receives a basic summary for the assignment, and the student sees their status, grade, feedback, and a post-completion error review if that mode is allowed.

Throughout the entire sequence, the generation sources, constraints, change history, assignment event, attempt state, assessment result, and artificial intelligence usage events must be preserved. In this way, the system ensures continuity between content, completion, assessment, and analytics.

## 4.2. User Roles and Area of Responsibility

**BR-01.** The student must have access only to assignments assigned to them, their own attempts, their own results, their own feedback, and actions permitted to them in the completion environment.

**BR-02.** The teacher must have access to material upload, generation, editing, assignment, assessment, results viewing, and basic analytics only within their area of responsibility.

**BR-03.** The administrator of the first version must have access to user management, viewing system objects, basic platform settings, and the log of key actions within the administrative scope.

**BR-04.** Permissions must not be mixed. A teacher must not receive administrative functions by default, and a student must not be able to influence the formal rules of assignment, review, or result publication.

## 4.3. End to End System Rules

**BR-05.** Assignment generation, assignment completion, and result assessment must be functionally separated and must not be merged into a single indistinguishable logic.

**BR-06.** The system must distinguish mandatory and practice assignments at the level of the interface, access rules, available actions, and analytics.

**BR-07.** The AI-based assistance policy must be set at the level of a specific assignment instance and must be enforced by the system.

**BR-08.** The sources and constraints on the basis of which an assignment was generated must be preserved and be available for subsequent analysis and audit.

**BR-09.** In the first version, the system must remain extensible, but extensibility must not lead to dilution of the boundaries of the current release.

# 5 Functional Requirements

## 5.1. Authentication, Sign In, and Basic Access

This block opens access to the system and defines the minimal access model sufficient for the school first version.

**FR-AUTH-01.** The system must support the creation of user accounts and sign in with role separation for student, teacher, and administrator.

**FR-AUTH-02.** After successful sign in, the system must open the interface corresponding to the user's role and available actions.

**FR-AUTH-03.** The system must provide for user session termination, automatic termination of an inactive session, and re authentication for critical administrative level actions.

**FR-AUTH-04.** The user must not see assignments, results, logs, or administrative elements unrelated to their role and access area.

**FR-AUTH-05.** Assignments, attempts, and results must be linked to specific users so as to prevent mixing of other people's work and grades.

## 5.2. Upload of Instructional Materials and Preparation of Generation Context

This block provides the teacher with the source basis for controlled generation. User materials must serve as a grounding context, not as a decorative attachment.

**FR-MAT-01.** The teacher must be able to upload instructional materials in common document formats suitable for text processing and use as generation context.

**FR-MAT-02.** The system must accept uploaded materials, prepare them for use in generation, and preserve the link between the material and the tasks that rely on it.

**FR-MAT-03.** The teacher must be able to constrain generation by topic, section, instructional constraints, difficulty level, and other parameters available in the first version.

**FR-MAT-04.** The system must show the teacher which materials are included in the generation context and allow unsuitable materials to be excluded before generation starts.

**FR-MAT-05.** Materials must be used as a controlled basis for generation, not as an optional recommendation to a language model.

## 5.3. Controlled Generation of Assignments and Worksheets

This block is the central functional distinction of EXPP from a conventional conversational assistant. Generation must occur within instructional constraints and be transparent to the educator.

**FR-GEN-01.** The system must support generation of a single assignment and generation of a worksheet consisting of multiple assignments.

**FR-GEN-02.** During generation, the system must take into account the teacher's uploaded materials, topic parameters, assignment format, target difficulty, and other specified constraints.

**FR-GEN-03.** The system must use a basic generation pipeline that includes retrieval of relevant context and a result planning stage before the final assignment text is formed.

**FR-GEN-04.** The system must allow regeneration of the entire assignment or part of it without losing the link to the original constraints.

**FR-GEN-05.** The system must show the teacher exactly what was generated and which instructional constraints were active at the time of generation.

**FR-GEN-06.** Generation must not automatically publish the result to students. Any generated material must first pass through the editing and teacher confirmation workflow.

## 5.4. Assignment and Worksheet Editor

The editor turns generation into a working tool. It is in this block that the educator makes the final decision about the content and form of the assignment.

**FR-EDIT-01.** The teacher must be able to edit wording, change the order of assignments, remove and add elements, and edit expected answers and solutions.

**FR-EDIT-02.** The system must allow an assignment to be saved both as a draft and as a final version suitable for assignment.

**FR-EDIT-03.** Before assignment, the teacher must be able to return to editing without having to regenerate the entire assignment.

**FR-EDIT-04.** The editor must function as a single environment in which the final result is visible, not as a set of fragmented dialogs or unpredictable generative steps.

## 5.5. Versioning of Instructional Content

Even in the first version, the system must preserve the history of changes to instructional content in order to maintain traceability and rollback capability.

**FR-VERS-01.** The system must preserve the change history of an assignment or worksheet.

**FR-VERS-02.** For each saved version, the author of the change and the time of the change must be recorded.

**FR-VERS-03.** The teacher must be able to restore a previous version of an assignment or worksheet.

**FR-VERS-04.** Assignment of an assignment to students must occur only from a fixed version suitable for publication.

## 5.6. Assignment Distribution and Configuration of the Completion Mode

Assignment distribution links the content workflow with the instructional completion workflow. In the first version, this block must be simple but complete.

**FR-ASN-01.** The teacher must be able to assign an assignment to one student or to several selected students.

**FR-ASN-02.** When assigning, the teacher must be able to specify the deadline, assignment status, and completion format available in the first version.

**FR-ASN-03.** The system must record the fact of assignment, the list of recipients, the assignment parameters, and the current version of the assignment that was assigned.

**FR-ASN-04.** Modifying an already assigned assignment must be a controlled action with transparent recording in the log and clear reflection for the assignment recipients.

## 5.7. Configuration of Access to AI-Based Assistance

The AI-based assistance policy is set at the time of assignment and applies in the completion environment. This block is mandatory and must be implemented as a system rule, not as a voluntary agreement.

**FR-AI-01.** When assigning an assignment, the teacher must be able to choose one of the assistance modes. Full prohibition of assistance, clarification mode, guided mode, or post-assessment review mode.

**FR-AI-02.** For a mandatory assignment that counts toward grading, the system must not provide a full partner mode during completion before the attempt is submitted.

**FR-AI-03.** If an invalid assistance mode is selected for a mandatory assignment, the system must automatically block such an assignment instance, show the reason for the restriction, and record the event.

**FR-AI-04.** The active assistance mode must be clearly displayed to the student before completion begins and while working on the assignment.

**FR-AI-05.** The teacher must be able to allow post-assessment review without opening more permissive assistance modes before the attempt is submitted.

## 5.8. Student Assignment Completion Environment

The completion environment must be sufficient to support the full instructional cycle without switching to external tools.

**FR-STU-01.** The student must be able to open an assigned assignment and see the instructions, deadline, assignment status, and active AI-based assistance mode.

**FR-STU-02.** The student must be able to enter a response in the available format, save intermediate progress, and return to the assignment before final submission.

**FR-STU-03.** The system must support final attempt submission as a separate confirmed action.

**FR-STU-04.** After final submission, the system must record the fact of submission and move the attempt into a state that is not open to unnoticed editing by the student.

**FR-STU-05.** If the student requests AI-based assistance in an allowed mode, the system must process the request within the boundaries of the assignment policy. If the mode is not allowed or the request goes beyond the policy boundaries, the system must block the request and indicate the reason.

## 5.9. Review, Assessment, and Result Publication

The assessment workflow must be separated from the generation and completion workflow. In the first version, a basic but complete mechanism for result review is required.

**FR-ASM-01.** The system must support automatic checking where the assignment format makes it possible and valid.

**FR-ASM-02.** The teacher must be able to perform a manual review of the result, leave a comment, and record the final grade.

**FR-ASM-03.** The system must support a mixed mode in which automatic checking produces a preliminary result and the teacher makes the final decision.

**FR-ASM-04.** The fact of submission, review status, and published result must be recorded as separate process states.

**FR-ASM-05.** After the result is published, the student must receive access to the grade, comments, and the allowed review after completion of the assignment.

## 5.10. Basic Analytics and Feedback

The analytics of the first version must be simple but sufficient to understand the result for the assignment and for each student.

**FR-ANL-01.** The teacher must see to whom the assignment was assigned, who started completion, who submitted, and who did not submit.

**FR-ANL-02.** The teacher must see the final result for each student and a summary for the specific assignment.

**FR-ANL-03.** The student must see their own completion status, their own grade, the comment, and the available review after completion of the assignment.

**FR-ANL-04.** The analytics of the first version must be limited to the level of a specific assignment and its specific recipients, without full-featured organizational analytics for the school or grade level.

**FR-ANL-05.** The fact of use of allowed or prohibited AI-based assistance must be available to the teacher as part of the assignment context without automatically distorting the grade itself.

## 5.11. Audit Log and Action Traceability

The audit log is a mandatory system layer. It is needed for transparency, resolution of disputed situations, and control of compliance with rules.

**FR-AUD-01.** The system must record assignment creation, assignment modification, assignment distribution, assignment submission, review, result publication, and events related to the use or attempted use of AI-based assistance.

**FR-AUD-02.** The log must store sufficient information to answer the question of who did what, when, and as part of which action.

**FR-AUD-03.** The administrator must be able to view the audit log within their permissions. The teacher must have access to relevant events for their own assignments.

**FR-AUD-04.** Audit log events must be suitable for subsequent analysis in disputed situations related to review, deadlines, or violation of the assistance mode.

## 5.12. Minimal Administrative Scope

The administrative scope of the first version must not turn into a separate large subsystem, but it must ensure controlled launch and maintenance of the product.

**FR-ADM-01.** The administrator must be able to create and modify users, assign roles, and block access where necessary.

**FR-ADM-02.** The administrator must be able to view the basic system objects required to control platform operation in the first version.

**FR-ADM-03.** The administrator must be able to manage basic platform settings related to access policies, feature availability, and the general operating rules of the school scope.

# 6 Requirements for AI-Based Assistance

Because AI-based assistance affects grading integrity and trust in the system, separate mandatory rules are established for it.

## 6.1. Supported Modes of the First Version

**AI-01.** The full prohibition mode must completely remove the assistance interface for the assignment and reject any direct requests to the assistance mechanism.

**AI-02.** The clarification mode must allow only clarification of the assignment wording, terms, and previously studied definitions without disclosing the solution path.

**AI-03.** The guided mode must allow leading questions and structuring of reasoning without giving a direct answer or step-by-step solution.

**AI-04.** The post-assessment review mode must be available only after the result is fixed and must be used for error analysis, explanations, and subsequent learning.

**AI-05.** A full intelligent partner mode is not included in the first version. Its absence in the first version must be fixed as a functional limitation.

## 6.2. Restrictions for Mandatory Graded Assignments

**AI-06.** If an assignment has mandatory status and counts toward grading, the system must not provide assistance capable of influencing the solution process before the final attempt is submitted.

**AI-07.** For a mandatory graded assignment, before attempt submission only the absence of assistance or the clarification mode is allowed, if it is explicitly enabled by the teacher and not prohibited by organizational policy.

**AI-08.** The guided mode for a mandatory graded assignment is allowed only if the assignment is not used as a formal assessment attempt. If the assignment affects grading, such a mode must be blocked.

**AI-09.** Post-assessment review may be opened only after the attempt is fixed and result publication is completed, or after another control point explicitly defined by system policy.

## 6.3. Enforced Policy Compliance

**AI-10.** Assistance mode restrictions must be checked at the level of the user interface, server business logic, and the gateway that calls the assistance mechanism.

**AI-11.** Attempts to access a prohibited assistance mode must be blocked by the system and recorded in the audit log.

**AI-12.** The system must not rely on voluntary compliance by the student. The assistance policy must be implemented as a technical restriction.

## 6.4. Transparency of Assistance Usage

**AI-13.** The system must show the student the active assistance mode and the boundaries of what is allowed within the current assignment.

**AI-14.** The teacher must see the fact that assistance was requested and the nature of the permitted intervention as assignment context.

**AI-15.** The history of assistance usage must be available for analysis in disputed cases without replacing the final assessment with this log.

# 7 Requirements for User Interfaces

Interface requirements are formulated not as requirements for visual style, but as requirements for clarity, controllability, and distinguishability of system states.

## 7.1. General Interface Principles

**UX-01.** The user must always see who they are in the system, where they are, and which actions are available to them on the current screen.

**UX-02.** Assignment status, deadline, completion stage, and AI-based assistance mode must be displayed explicitly and without hidden transitions.

**UX-03.** Critical actions, including final attempt submission, result publication, and changes to the assistance policy, must require explicit confirmation.

**UX-04.** Errors and restrictions must be explained in clear text that helps complete the task, not merely reports a prohibition.

**UX-05.** The interface must not mix assignment preparation, assignment completion, and result review actions in one indistinguishable space.

## 7.2. Teacher Interface

**UX-06.** The teacher interface must unite work with materials, generation, editing, assignment, attempt review, assessment, and analytics into a single working sequence.

**UX-07.** The teacher must see the stage each assignment is at. Draft, ready for assignment, assigned, in progress, submitted, reviewed.

**UX-08.** When assigning, the teacher must see all parameters that affect the completion mode. Deadline, assignment status, and assistance mode.

## 7.3. Student Interface

**UX-09.** The student interface must separate the list of received assignments from the screen for completing a specific assignment.

**UX-10.** On the completion screen, the student must see only the tools that are permitted for the current assignment.

**UX-11.** After an attempt is submitted, the interface must unambiguously show that the work is fixed and that further modification is unavailable without a separate system action.

## 7.4. Administrator Interface

**UX-12.** The administrative interface must be separate from the teaching and student interface and must not be opened to a user by mistake through mixed roles.

**UX-13.** The administrator must be able to view the action log, users, and basic settings without needing to switch to the teacher or student interface.

# 8 Requirements for Software Interfaces and Module Interaction

The first version must have formally described software interfaces. This is necessary for reproducible development, testing, integration, and maintenance.

## 8.1. General Interface Requirements

**API-01.** The external synchronous HTTP interface of the system must be described by a machine-readable OpenAPI specification and maintained as an up-to-date project artifact.

**API-02.** If a GraphQL interface is used in the project, it must be described by a separate versioned schema and must not replace the mandatory contractual description of the external HTTP interface of the first version.

**API-03.** If asynchronous events or message exchange are used in the project, the events must be described through AsyncAPI with recorded channels, message formats, and publication rules.

**API-04.** Each software interface must have an unambiguous policy for authentication, authorization, versioning, error handling, and logging of critical calls.

## 8.2. Mandatory Groups of Software Interfaces

- Authentication and session management interfaces.
- Material upload and preparation interfaces.
- Assignment and worksheet generation interfaces.
- Editing, saving, and versioning interfaces.
- Assignment distribution and assistance mode configuration interfaces.
- Student assignment retrieval, draft saving, and attempt submission interfaces.
- Review, grade publication, and feedback retrieval interfaces.
- Basic analytics and audit log viewing interfaces within the permitted role.

## 8.3. Requirements for the Event Model

**API-05.** If the system implements internal event exchange, there must exist at minimum events for assignment distribution, draft saving, attempt submission, grade publication, assistance mode change, and blocking of a prohibited assistance request.

**API-06.** The event interface must not create ambiguity as to the source of truth. The state of the assignment and attempt must be defined by the core business logic, and events must be used for synchronization and observability.

# 9 Non Functional Requirements

Non functional requirements for the first version are formulated so that the system is fit for real operation in the school scope, not only for demonstration.

## 9.1. Performance

**NFR-PERF-01.** Standard interface operations for viewing lists, opening an assignment screen, viewing results, and saving settings must execute with a response time perceived by the user as prompt. For the target level of the first version, the benchmark should be a ninety fifth percentile of no more than two seconds for standard screens under nominal load.

**NFR-PERF-02.** Generation start must be acknowledged quickly, and generation itself must execute as a managed process with a status understandable to the user. A longer execution time is acceptable for generation, but the user must see that the process has been accepted and is being processed.

**NFR-PERF-03.** Saving a draft response must be acknowledged without noticeable delay and must not lead to loss of already saved content.

## 9.2. Reliability and Resilience

**NFR-REL-01.** After confirmed saving of a draft or modification of an assignment, the system must not lose the recorded state under normal application level failures.

**NFR-REL-02.** The system must support repeatability of key operations and correct recovery after application errors without duplication of critical actions.

**NFR-REL-03.** The first version must have a procedure for backup, recovery, and integrity control of user results and audit logs.

## 9.3. Security and Confidentiality

**NFR-SEC-01.** Technical measures for protecting the web application must meet a verification level no lower than what is sufficient for an internet-accessible application service with personal data of minor users.

**NFR-SEC-02.** The system must provide strict user authentication, session control, access separation, and protection against unauthorized reading or modification of other people's data.

**NFR-SEC-03.** File upload must be accompanied by checks of type, size, processing admissibility, and a secure content parsing workflow.

**NFR-SEC-04.** The system must minimize the amount of personal data displayed, separate parent, administrative, and pedagogical views, and prevent accidental disclosure of sensitive information.

**NFR-SEC-05.** Any data related to assessment, assistance policies, and the audit log must have an elevated level of protection and a restricted access circle.

## 9.4. Usability and Human Centered Design

**NFR-UX-01.** Key user tasks of the first version must be executable without the need for external user training or consultation of hidden service instructions.

**NFR-UX-02.** The interface must distinguish mandatory and practice assignments, review stages, and assistance modes so that they cannot be confused in normal work.

**NFR-UX-03.** The system must undergo clarity validation of key scenarios with participation of representatives of the target roles.

**NFR-UX-04.** Interface text, warnings, and error messages must be substantively understandable for the school context, not technical or model oriented.

## 9.5. Observability and Maintenance

**NFR-OPS-01.** The system must collect application logs, technical errors, security events, and metrics of key user operations.

**NFR-OPS-02.** For critical transactions, there must be a unified trace identifier that allows linking the interface action, server-side processing, and the audit log entry.

**NFR-OPS-03.** The maintenance team must have means to diagnose generation failures, material upload errors, review errors, and blocks caused by assistance policy.

## 9.6. Extensibility Without Expanding the Scope of the First Version

**NFR-EXT-01.** The architecture of the first version must allow subsequent addition of complex instructional structures, extended analytics, and additional assistance modes without destroying the already implemented basic logic.

**NFR-EXT-02.** Deferred features must not leak into the first version in the form of unfinished screens, inactive toggles, or logical stubs that create a false impression of readiness.

# 10 Requirements for Security and Verification of Protection

The first version of EXPP must be treated as an internet-accessible web application working with personal data and learning results. Therefore, security requirements are a mandatory part of acceptance, not an after the fact improvement.

## 10.1. Mandatory Verification Areas

- Authentication verification, session management, and protection against account compromise.
- Verification of access separation between student, teacher, and administrator.
- Verification of protection against standard web application risks, including insecure access control, authentication errors, injections, insecure file upload, insecure handling of user input, and insufficient logging.
- Verification that restrictions on AI-based assistance are in fact enforced at all levels.
- Verification of logging of critical events and the impossibility of unnoticed circumvention of prohibitions.

## 10.2. Requirements for Protection of Content and Assessment

**SEC-01.** The system must not allow a user to access materials, assignments, attempts, or results that have not been assigned to them or are not permitted by their role.

**SEC-02.** The system must prevent identity substitution during attempt submission, review, or administrative actions.

**SEC-03.** The review result and published grade must not be changed without an explicitly recorded action and a corresponding entry in the log.

**SEC-04.** Prohibited requests for AI-based assistance must be blocked before a substantive response is issued.

**SEC-05.** Instructional materials uploaded by the teacher must not be available to students as a separate internal repository unless this is implied by the logic of a specific assignment.

# 11 Requirements for Project Artifacts, Validation, and Acceptance

The result of implementing the first version must be not only a working system but also a set of supporting artifacts sufficient for its support, verification, and further development.

## 11.1. Mandatory Project Artifacts

- The current version of this technical specification.
- Architectural description of the system with separate views for functional logic, interfaces, security, operations, and integration interactions.
- Specification of the external HTTP interface in OpenAPI.
- GraphQL schema, if GraphQL is used in the project.
- Specification of event-driven interfaces in AsyncAPI, if the project includes event exchange.
- Test plan and a set of test cases linked to the document requirements.
- Acceptance test report.
- Operating instructions for launching the system and a minimal user guide for the roles of the first version.

## 11.2. General Traceability Rules

**VAL-01.** Each functional and non-functional requirement must have an identifier and be linked to at least one method of verification. Demonstration, test, inspection, or analysis.

**VAL-02.** A change to a requirement after approval must lead to an update of related tests, project artifacts, and acceptance criteria.

**VAL-03.** Acceptance cannot be considered complete if a functional scenario is implemented but the critical restrictions on security, logging, and assistance policy remain unverifiable.

## 11.3. Mandatory Acceptance Criteria for the First Version

**ACC-01.** The teacher uploads instructional materials, sets instructional constraints, launches generation of an assignment or worksheet, and receives a result suitable for editing.

**ACC-02.** The teacher edits the result, saves the final version, and assigns the assignment to one or more students with the specified deadline and the specified assistance policy.

**ACC-03.** The student receives the assigned assignment, sees the instructions, deadline, and active assistance mode, completes the assignment, saves intermediate progress, and submits the final attempt.

**ACC-04.** The system applies the AI-based assistance policy without workarounds. Permitted actions are available, prohibited ones are blocked and logged.

**ACC-05.** The teacher receives the attempt, performs the review, records the result, and publishes the grade.

**ACC-06.** The student sees their own result and feedback, and the post-completion error review opens only at the permitted stage.

**ACC-07.** The teacher sees basic analytics for the assignment. Who received the assignment, who submitted and who did not, and what result was obtained for each student.

**ACC-08.** The audit log contains key events for the assignment and allows the course of its lifecycle to be reconstructed from creation to result publication.

# 12 Final Definition of Readiness of the First Version

The first version of EXPP is considered correctly implemented if the system provides the full instructional cycle of the school scope without manual workarounds and external crutches. The teacher must be able to prepare an assignment based on their own materials, configure and assign it with the correct assistance policy, the student must be able to complete and submit the assignment within the platform, and then both sides must receive the result, feedback, and basic analytics. At the same time, the principles of separation of generation, completion, and assessment, as well as enforced compliance with restrictions on AI-based assistance, must be implemented technically, not declaratively.

## 12.1. What Is Considered a Readiness Violation

- If assignment generation is not tied to the user's materials and instructional constraints.
- If an assignment can be distributed without fixing the assistance policy, or if that policy is not technically enforced.
- If a student can bypass assistance restrictions and obtain prohibited support before submitting a mandatory graded assignment.
- If after submission it is impossible to reliably reconstruct the history of actions for the assignment and attempt.
- If result review, grade publication, and basic analytics do not form one connected process.

