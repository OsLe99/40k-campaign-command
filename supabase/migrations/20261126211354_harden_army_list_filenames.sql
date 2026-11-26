-- Avoid escape-string ambiguity when checking filenames across SQL clients.
alter table public.army_lists drop constraint army_lists_file_name_check;
alter table public.army_lists add constraint army_lists_file_name_check check (
  length(file_name) between 1 and 180
  and position('/' in file_name) = 0
  and position(chr(92) in file_name) = 0
  and file_name !~ '[[:cntrl:]]'
);
