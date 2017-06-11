--------------------------------------------------------
-- SAMPLE QUERIES 
--------------------------------------------------------

-- 1. Find all patients (return PATIENT_NUM) diagnosed with migraines
SELECT DISTINCT (PATIENT_NUM)
FROM OBSERVATION_FACT
WHERE CONCEPT_CD IN 
        (SELECT CONCEPT_CD
FROM CONCEPT_DIMENSION
WHERE CONCEPT_PATH LIKE '%Neurologic Disorders (320-389)\\(346) Migraine\\%');


-- 2. Find age of the same patient set
SELECT CONCEPT_CD
FROM OBSERVATION_FACT
WHERE CONCEPT_CD LIKE 'DEM|Age%' AND PATIENT_NUM IN (SELECT PATIENT_NUM
    FROM OBSERVATION_FACT
    WHERE CONCEPT_CD IN (SELECT CONCEPT_CD
    FROM CONCEPT_DIMENSION
    WHERE CONCEPT_PATH LIKE '%Neurologic Disorders (320-389)\\(346) Migraine\\%' ));

-- 3. Ages of patients with Cholestoral Lab
SELECT CONCEPT_CD
FROM OBSERVATION_FACT
WHERE CONCEPT_CD LIKE 'DEM|Age%' AND PATIENT_NUM IN (SELECT PATIENT_NUM
    FROM OBSERVATION_FACT
    WHERE CONCEPT_CD IN
    -- This could be replaced by the metatdata using just the name of the term
    (SELECT CONCEPT_CD
    FROM CONCEPT_DIMENSION
    WHERE CONCEPT_PATH LIKE '%LAB\(LLB16) Chemistry\(LLB17) Lipid Tests\CHOL\%' ));

--------------------------------------------------------
-- SAMPLE METADATA QUERIES
--------------------------------------------------------

-- GENERAL QUERY
SELECT C_FACTTABLECOLUMN FROM C_TABLENAME WHERE C_COLUMNNAME C_OPERATOR C_DIMCODE

-- For most CONCEPT_DIMENSION based queries this will appear as:
SELECT CONCEPT_CD FROM CONCEPT_DIMENSION WHERE CONCEPT_PATH LIKE ‘\Diagnoses\Circulatory system\%’

-- For a PATIENT_DIMENSION based query this may appear as:
SELECT PATIENT_NUM FROM PATIENT_DIMENSION WHERE BIRTH_DATE BETWEEN ‘getdate() AND GETDATE() – 365.25(10) ’

-- For a VISIT_DIMENSION based query this may appear as:
SELECT ENCOUNTER_NUM FROM VISIT_DIMENSION WHERE INOUT_CD = ‘I’

-- For a PROVIDER_DIMENSION based query this may appear as:
SELECT PROVIDER_ID FROM PROVIDER_DIMENSION WHERE PROVIDER_PATH LIKE ‘\Providers\Emergency\%’