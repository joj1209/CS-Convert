BEGIN
/********************************************/
/* PGM ID : test.sql                      */
/* TARGET TABLE : test_table                */

    DECLARE vs_job_d STRING DEFAULT {vs_job_d};
    DECLARE vs_pgm_id STRING DEFAULT {vs_pgm_id};
    DECLARE vs_tbl_nm STRING DEFAULT {vs_tbl_nm};

ENd;



    DECLARE vs_job_d STRING DEFAULT @standard_date;
    DECLARE vs_pgm_id STRING DEFAULT @program_id;
    DECLARE vs_tbl_nm STRING DEFAULT @table_name;