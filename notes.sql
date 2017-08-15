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
SELECT PROVIDER_ID FROM PROVIDER_DIMENSION WHERE PROVIDER_PATH LIKE ‘\Providers\Emergency\%’;

--------------------------------------------------------
-- SAMPLE GROUP QUERYING
--------------------------------------------------------
SELECT array_length(array(SELECT unnest(array(SELECT DISTINCT PATIENT_NUM FROM OBSERVATION_FACT WHERE CONCEPT_CD LIKE '%LOINC:2093-3%')) INTERSECT
              SELECT unnest(array(SELECT DISTINCT PATIENT_NUM FROM OBSERVATION_FACT WHERE CONCEPT_CD LIKE '%LOINC:1920-8%'))),1);

SELECT CONCEPT_CD, COUNT (*) FROM

(SELECT CONCEPT_CD FROM OBSERVATION_FACT
WHERE (CONCEPT_CD LIKE 'DEM|RACE%' OR CONCEPT_CD LIKE 'DEM|AGE%' OR CONCEPT_CD LIKE 'DEM|RELIGION%' OR CONCEPT_CD LIKE 'DEM|LANGUAGE%' OR CONCEPT_CD LIKE 'DEM|SEX%') AND PATIENT_NUM IN (SELECT DISTINCT(PATIENT_NUM)
    FROM OBSERVATION_FACT
    WHERE CONCEPT_CD LIKE '%LOINC:19%')) A GROUP BY concept_cd ORDER BY 1;

SELECT unnest(array(SELECT DISTINCT PATIENT_NUM FROM OBSERVATION_FACT WHERE CONCEPT_CD LIKE '%LOINC:1920-8%')) UNION SELECT unnest(array(SELECT DISTINCT PATIENT_NUM FROM OBSERVATION_FACT WHERE CONCEPT_CD LIKE '%LOINC:2093-3%')) INTERSECT SELECT unnest(array(SELECT DISTINCT PATIENT_NUM FROM OBSERVATION_FACT WHERE CONCEPT_CD LIKE '%LOINC:2093-3%'))

SELECT CONCEPT_CD, COUNT (*) FROM(SELECT CONCEPT_CD FROM OBSERVATION_FACT WHERE (CONCEPT_CD LIKE 'DEM|RACE%' OR CONCEPT_CD LIKE 'DEM|AGE%' OR CONCEPT_CD LIKE 'DEM|RELIGION%' OR CONCEPT_CD LIKE 'DEM|LANGUAGE%' OR CONCEPT_CD LIKE 'DEM|SEX%') AND PATIENT_NUM IN (SELECT unnest(array(SELECT DISTINCT PATIENT_NUM FROM OBSERVATION_FACT WHERE CONCEPT_CD LIKE '%LOINC:1920-8%')) UNION SELECT unnest(array(SELECT DISTINCT PATIENT_NUM FROM OBSERVATION_FACT WHERE CONCEPT_CD LIKE '%LOINC:2093-3%')) INTERSECT SELECT unnest(array(SELECT DISTINCT PATIENT_NUM FROM OBSERVATION_FACT WHERE CONCEPT_CD LIKE '%LOINC:2093-3%')))) A GROUP BY concept_cd ORDER BY 1

-- Gets concept_cd and num of patient ordered for given searchTerm
SELECT concept_cd, COUNT (concept_cd) FROM (SELECT DISTINCT PATIENT_NUM, CONCEPT_CD FROM OBSERVATION_FACT WHERE CONCEPT_CD IN (SELECT c_basecode FROM i2b2metadata.i2b2 WHERE LOWER(c_name) LIKE '%loinc:19%' ESCAPE '#')) A GROUP BY concept_cd ORDER BY COUNT DESC


-- Searches concepts with patients > 1 and with searchText -Great!!!
DROP TABLE IF EXISTS temp_data;
CREATE temporary TABLE temp_data AS (
SELECT concept_cd, patients FROM (
SELECT concept_cd, COUNT(concept_cd) AS patients FROM 
(SELECT DISTINCT PATIENT_NUM, CONCEPT_CD FROM OBSERVATION_FACT WHERE CONCEPT_CD IN
(SELECT DISTINCT c_basecode FROM i2b2metadata.i2b2 WHERE LOWER(c_name) LIKE '%cholesterol%' ESCAPE '#')) AS B GROUP BY concept_cd ORDER BY patients DESC) AS A GROUP BY concept_cd, patients ORDER BY patients DESC);

SELECT * FROM (SELECT DISTINCT ON (temp.concept_cd) temp.concept_cd, temp.patients, main.name_char AS c_name, main.concept_path AS c_fullname FROM temp_data temp INNER JOIN concept_dimension main ON temp.concept_cd = main.concept_cd) A ORDER BY patients DESC

-- SELECT t2.c_basecode FROM i2b2metadata.i2b2 t1 INNER JOIN i2b2metadata.icd10_icd9 t2 ON LOWER(t2.c_name) LIKE '%migraine%' AND LOWER(t1.c_name)=LOWER(t2.c_name)

SELECT DISTINCT t2.c_fullname, t2.c_basecode, t2.c_name FROM i2b2metadata.i2b2 t1 INNER JOIN i2b2metadata.icd10_icd9 t2 ON LOWER(t2.c_name) LIKE '%contact lens%' AND LOWER(t1.c_name) LIKE '%contact lens%'